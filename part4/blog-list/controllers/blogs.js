const blogsRouter = require("express").Router();
const User = require("../models/user");
const Blog = require("../models/blog");

blogsRouter.get("/", async (req, res, next) => {
  try {
    const blogs = await Blog.find({}).populate("user", {
      username: 1,
      name: 1
    });
    res.json(blogs.map(blog => blog.toJSON()));
  } catch (e) {
    next(e);
  }
});

blogsRouter.get("/:id", async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (blog) {
      res.json(blog.toJSON());
    } else {
      res.status(404).end();
    }
  } catch (e) {
    next(e);
  }
});

blogsRouter.post("/", async (req, res, next) => {
  const { body } = req;

  try {
    const defaultUser = await User.findOne();

    const blog = new Blog({
      title: body.title,
      author: body.author || "",
      url: body.url,
      likes: body.likes || 0,
      user: defaultUser._id
    });

    const savedBlog = await blog.save();
    defaultUser.blogs = defaultUser.blogs.concat(savedBlog._id);
    await defaultUser.save();
    res.status(201).json(savedBlog.toJSON());
  } catch (e) {
    next(e);
  }
});

blogsRouter.delete("/:id", async (req, res, next) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (deletedBlog) {
      res.status(204).end();
    } else {
      res.status(404).end();
    }
  } catch (e) {
    next(e);
  }
});

blogsRouter.put("/:id", async (req, res, next) => {
  const { body } = req;

  try {
    const blog = await Blog.findById(req.params.id);
    if (blog) {
      blog.title = body.title;
      blog.url = body.url;
      blog.likes = body.likes;
      await blog.save();
      res.status(200).end();
    } else {
      res.status(404).end();
    }
  } catch (e) {
    next(e);
  }
});

module.exports = blogsRouter;
