const { UserInputError, AuthenticationError } = require("apollo-server");
const Post = require("../../models/Post");
const checkAuth = require("../../ulil/check-auth");

module.exports = {
    Query: {
        getPosts: async () => {
            try {
                return await Post.find().sort({ createdAt: -1 });
            } catch (err) {
                throw new Error(err);
            }
        },
        getPost: async (_, { postId }) => {
            try {
                const post = await Post.findById(postId);
                if (!post) {
                    throw new Error("No such post");
                }
                return post;
            } catch (err) {
                throw new Error(err);
            }
        },
    },

    Mutation: {
        createPost: async (_, { body }, context) => {
            const user = checkAuth(context);

            if (body.trim() === "") {
                throw new Error("Post body must not be empty");
            }

            const newPost = new Post({
                body,
                username: user.username,
                createdAt: new Date().toISOString(),
                user: user.id,
            });

            const post = await newPost.save();

            context.pubsub.publish("NEW_POST", { newPost: post });

            return post;
        },
        deletePost: async (_, { postId }, context) => {
            const user = checkAuth(context);

            try {
                const post = await Post.findById(postId);
                if (user.username === post.username) {
                    await post.delete();
                    return "Post deleted successfully";
                } else {
                    throw new AuthenticationError("Action not allowed");
                }
            } catch (err) {
                throw new Error(err);
            }
        },
        async likePost(_, { postId }, context) {
            const { username } = checkAuth(context);

            const post = await Post.findById(postId);
            if (post) {
                const likeIndex = post.likes.findIndex(
                    (like) => like.username === username
                );
                if (likeIndex > -1) {
                    post.likes.splice(likeIndex, 1);
                } else {
                    post.likes.push({
                        username,
                        createdAt: new Date().toISOString(),
                    });
                }
                return await post.save();
            } else {
                throw new UserInputError("Post not found");
            }
        },
    },

    Subscription: {
        newPost: {
            subscribe: (_, __, { pubsub }) => pubsub.asyncIterator("NEW_POST"),
        },
    },
};
