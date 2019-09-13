package backend

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/google/zoekt"
	zoektquery "github.com/google/zoekt/query"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/internal/pkg/search"
	"github.com/sourcegraph/sourcegraph/pkg/api"
	"github.com/sourcegraph/sourcegraph/pkg/trace"
)

// Zoekt wraps a zoekt.Searcher.
//
// Note: Zoekt starts up background goroutines, so call Close when done using
// the Client.
type Zoekt struct {
	Client zoekt.Searcher

	// DisableCache when true prevents caching of Client.List. Useful in
	// tests.
	DisableCache bool

	mu       sync.RWMutex
	state    int32 // 0 not running, 1 running, 2 stopped
	set      map[string]*zoekt.Repository
	err      error
	disabled bool
}

// Close will tear down the background goroutines.
func (c *Zoekt) Close() {
	c.mu.Lock()
	c.state = 2
	c.mu.Unlock()
}

func (c *Zoekt) String() string {
	return fmt.Sprintf("zoekt(%v)", c.Client)
}

func (c *Zoekt) Search(ctx context.Context, args *search.Args) (*zoekt.SearchResult, error) {
	if len(repos) == 0 {
		return &zoekt.SearchResult{}, nil
	}

	// Tell zoekt which repos to search
	repoSet := &zoektquery.RepoSet{Set: make(map[string]bool, len(repos))}
	repoMap := make(map[api.RepoName]*search.RepositoryRevisions, len(repos))
	for _, repoRev := range repos {
		repoSet.Set[string(repoRev.Repo.Name)] = true
		repoMap[api.RepoName(strings.ToLower(string(repoRev.Repo.Name)))] = repoRev
	}

	queryExceptRepos, err := queryToZoektQuery(query, isSymbol)
	if err != nil {
		return nil, false, nil, err
	}
	finalQuery := zoektquery.NewAnd(repoSet, queryExceptRepos)

	tr, ctx := trace.New(ctx, "zoekt.Search", fmt.Sprintf("%d %+v", len(repoSet.Set), finalQuery.String()))
	defer func() {
		tr.SetError(err)
		if len(fm) > 0 {
			tr.LazyPrintf("%d file matches", len(fm))
		}
		tr.Finish()
	}()

	if useFullDeadline {
		// If the user manually specified a timeout, allow zoekt to use all of the remaining timeout.
		deadline, _ := ctx.Deadline()
		searchOpts.MaxWallTime = time.Until(deadline)

		// We don't want our context's deadline to cut off zoekt so that we can get the results
		// found before the deadline.
		//
		// We'll create a new context that gets cancelled if the other context is cancelled for any
		// reason other than the deadline being exceeded. This essentially means the deadline for the new context
		// will be `deadline + time for zoekt to cancel + network latency`.
		cNew, cancel := context.WithCancel(context.Background())
		go func(cOld context.Context) {
			<-cOld.Done()
			// cancel the new context if the old one is done for some reason other than the deadline passing.
			if cOld.Err() != context.DeadlineExceeded {
				cancel()
			}
		}(ctx)
		ctx = cNew
		defer cancel()
	}

	// If the query has a `repohasfile` or `-repohasfile` flag, we want to construct a new reposet based
	// on the values passed in to the flag.
	newRepoSet, err := createNewRepoSetWithRepoHasFileInputs(ctx, query, searcher, *repoSet)
	if err != nil {
		return nil, false, nil, err
	}
	finalQuery = zoektquery.NewAnd(newRepoSet, queryExceptRepos)
	tr.LazyPrintf("after repohasfile filters: nRepos=%d query=%v", len(newRepoSet.Set), finalQuery)

	t0 := time.Now()
	return c.Client.Search(ctx, finalQuery, &searchOpts)
}

// ListAll returns the response of List without any restrictions.
func (c *Zoekt) ListAll(ctx context.Context) (map[string]*zoekt.Repository, error) {
	if !c.Enabled() {
		// By returning an empty list Text.Search won't send any queries to
		// Zoekt.
		return map[string]*zoekt.Repository{}, nil
	}

	c.mu.RLock()
	set, err := c.set, c.err
	c.mu.RUnlock()

	// No cached responses, start up and just do uncached query.
	if set == nil && err == nil {
		if !c.DisableCache {
			go c.start()
		}
		set, err = c.list(ctx)
	}

	return set, err
}

// SetEnabled will disable zoekt if b is false.
func (c *Zoekt) SetEnabled(b bool) {
	c.mu.Lock()
	c.disabled = !b
	c.mu.Unlock()
}

// Enabled returns true if Zoekt is enabled. It is enabled if Client is
// non-nil and it hasn't been disabled by SetEnable.
func (c *Zoekt) Enabled() bool {
	c.mu.Lock()
	b := c.disabled
	c.mu.Unlock()
	return c.Client != nil && !b
}

func (c *Zoekt) list(ctx context.Context) (map[string]*zoekt.Repository, error) {
	resp, err := c.Client.List(ctx, &zoektquery.Const{Value: true})
	if err != nil {
		return nil, err
	}

	set := make(map[string]*zoekt.Repository, len(resp.Repos))
	for _, r := range resp.Repos {
		set[strings.ToLower(r.Repository.Name)] = &r.Repository
	}

	return set, nil
}

// start starts a goroutine that keeps the listResp and listErr fields updated
// from the Zoekt server, as a local cache.
func (c *Zoekt) start() {
	c.mu.Lock()
	if c.state != 0 {
		// already running or stopped
		c.mu.Unlock()
		return
	}
	c.state = 1 // mark running
	c.mu.Unlock()

	errorCount := 0
	state := int32(1)
	for state == 1 {
		if !c.Enabled() {
			// If we haven't been stopped, reset state so start() is called
			// again when we are enabled. We can defer unlocking since we will
			// return.
			c.mu.Lock()
			defer c.mu.Unlock()
			if c.state == 1 {
				c.state, c.set, c.err = 0, nil, nil
			}
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		set, err := c.list(ctx)
		cancel()

		if err != nil {
			errorCount++
		} else {
			errorCount = 0
		}

		c.mu.Lock()
		state = c.state
		// Only update on error once it has happened 3 times in a row. This is
		// to prevent us caching transient errors, and instead fallback on the
		// old list.
		if errorCount == 0 || errorCount > 3 {
			c.set, c.err = set, err
		}
		c.mu.Unlock()

		randSleep(5*time.Second, 2*time.Second)
	}
}

// randSleep will sleep for an expected d duration with a jitter in [-jitter /
// 2, jitter / 2].
func randSleep(d, jitter time.Duration) {
	delta := time.Duration(rand.Int63n(int64(jitter))) - (jitter / 2)
	time.Sleep(d + delta)
}
