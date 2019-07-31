package testutil

import (
	"context"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend"
	"github.com/sourcegraph/sourcegraph/enterprise/cmd/frontend/internal/threadlike/internal"
	"github.com/sourcegraph/sourcegraph/pkg/api"
)

// CreateThread creates a thread in the DB, for use in tests only.
func CreateThread(ctx context.Context, title string, repositoryID api.RepoID) (id int64, err error) {
	thread, err := internal.DBThreads{}.Create(ctx, &internal.DBThread{
		Type:         graphqlbackend.ThreadlikeTypeThread,
		RepositoryID: repositoryID,
		Title:        title,
	})
	if err != nil {
		return 0, err
	}
	return thread.ID, nil
}