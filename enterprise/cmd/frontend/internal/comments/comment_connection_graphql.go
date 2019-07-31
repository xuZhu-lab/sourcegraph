package comments

import (
	"context"

	"github.com/graph-gophers/graphql-go"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend/graphqlutil"
)

func (GraphQLResolver) Comments(ctx context.Context, arg *graphqlutil.ConnectionArgs) (graphqlbackend.CommentConnection, error) {
	return commentsByOptions(ctx, dbCommentsListOptions{}, arg)
}

func (GraphQLResolver) CommentsForObject(ctx context.Context, object graphql.ID, arg *graphqlutil.ConnectionArgs) (graphqlbackend.CommentConnection, error) {
	var opt dbCommentsListOptions
	var err error
	opt.ThreadID, err = commentLookupInfoFromGQLID(object)
	if err != nil {
		return nil, err
	}

	return commentsByOptions(ctx, opt, arg)
}

func commentsByOptions(ctx context.Context, opt dbCommentsListOptions, arg *graphqlutil.ConnectionArgs) (graphqlbackend.CommentConnection, error) {
	comments, err := dbComments{}.List(ctx, opt)
	if err != nil {
		return nil, err
	}
	return &commentConnection{arg: arg, comments: comments}, nil
}

type commentConnection struct {
	arg      *graphqlutil.ConnectionArgs
	comments []*DBComment
}

func (r *commentConnection) Nodes(ctx context.Context) ([]graphqlbackend.Comment, error) {
	comments := r.comments
	if first := r.arg.First; first != nil && len(comments) > int(*first) {
		comments = comments[:int(*first)]
	}

	comments2 := make([]graphqlbackend.Comment, len(comments))
	for i, c := range comments {
		c, err := newGQLToComment(ctx, c)
		if err != nil {
			return nil, err
		}
		comments2[i] = c
	}
	return comments2, nil
}

func (r *commentConnection) TotalCount(ctx context.Context) (int32, error) {
	return int32(len(r.comments)), nil
}

func (r *commentConnection) PageInfo(ctx context.Context) (*graphqlutil.PageInfo, error) {
	return graphqlutil.HasNextPage(r.arg.First != nil && int(*r.arg.First) < len(r.comments)), nil
}