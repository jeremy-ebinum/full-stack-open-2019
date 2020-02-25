import React from "react";
import {
  render,
  within,
  fireEvent,
  cleanup,
  act,
  waitForElement,
  waitForElementToBeRemoved,
} from "@testing-library/react";
// eslint-disable-next-line no-unused-vars
import { prettyDOM } from "@testing-library/dom";
import testHelper from "./helpers/testHelper";
import _times from "lodash/times";
import nock from "nock";
import App, { testIDs as appTestIDs } from "./App";
import { testIDs as loginTestIDs } from "./components/Login";
import { testIDs as modalSpinnerTestIDs } from "./components/ModalSpinner";
import { testIDs as navbarTestIDs } from "./components/NavBar";
import { testIDs as blogTestIDs } from "./components/Blog";

jest.useFakeTimers();

let blogs;
beforeAll(() => {
  blogs = testHelper.blogs;
});

describe("<App />", () => {
  describe("When user is not logged in", () => {
    afterEach(() => {
      cleanup();
    });

    test("blogs are not rendered", async () => {
      const { container, queryByTestId } = render(<App />);
      expect(queryByTestId(appTestIDs.blogs)).not.toBeInTheDocument();
      expect(container).not.toHaveTextContent(blogs[0].title);
      expect(container).not.toHaveTextContent(blogs[0].author);
    });

    test("login form is rendered", async () => {
      const { findByRole, getByText } = render(<App />);
      const loginForm = await findByRole("form");
      const loginBtn = getByText(/login|sign in/i, {
        selector: "*[type='submit']",
      });

      expect(loginForm).toContainElement(loginBtn);
    });

    test("clicking the password icon toggles password masking", async () => {
      const component = render(<App />);
      await component.findByRole("form");
      const passwordInput = component.getByLabelText("password");
      const toggleBtn = component.getByTestId(loginTestIDs.toggleShowPassword);

      fireEvent.click(toggleBtn);

      expect(passwordInput.getAttribute("type")).toBe("text");

      fireEvent.click(toggleBtn);

      expect(passwordInput).toHaveAttribute(
        "type",
        expect.stringContaining("password")
      );
    });

    test("a loading modal is shown on submitting the login form", async () => {
      nock(testHelper.host)
        .persist()
        .post(testHelper.loginPath)
        .reply(200, testHelper.validLoggedInUser)
        .get(testHelper.blogsPath)
        .reply(200, testHelper.blogs);

      const { findByText, getByTestId, unmount } = render(<App />);
      const loginBtn = await findByText(/login|sign in/i, {
        selector: "*[type='submit']",
      });

      await act(async () => {
        fireEvent.click(loginBtn);
      });

      await waitForElementToBeRemoved(() => [
        getByTestId(modalSpinnerTestIDs.modalSpinner),
      ]);

      unmount();
      nock.cleanAll();
    });
  });

  describe("When user is logged in", () => {
    beforeEach(() => {
      const user = testHelper.validLoggedInUser;
      localStorage.setItem("loggedInBloglistUser", JSON.stringify(user));
    });

    afterEach(() => {
      cleanup();
      nock.cleanAll();
    });

    test("blogs are fetched from backend and rendered", async () => {
      nock(testHelper.host)
        .persist()
        .get(testHelper.blogsPath)
        .reply(200, testHelper.blogs);

      const { getByText, getByTestId } = render(<App />);

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      const blogNodes = await waitForElement(() =>
        blogs.reduce((elementsToWaitFor, blog) => {
          elementsToWaitFor.push(getByText(blog.title));

          return elementsToWaitFor;
        }, [])
      );

      expect(blogNodes.length).toBe(blogs.length);
    });

    test("clicking the logout button logs out the user", async () => {
      nock(testHelper.host)
        .persist()
        .get(testHelper.blogsPath)
        .reply(200, testHelper.blogs);

      const { findByText, getByTestId, queryByText } = render(<App />);

      const logoutBtn = await findByText(/logout|sign out/i, {
        selector: "button",
      });

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      expect(queryByText(blogs[0].title)).toBeInTheDocument();

      fireEvent.click(logoutBtn);
      expect(localStorage.getItem("loggedInBloglistUser")).toBe(null);
      expect(queryByText(blogs[0].title)).toBe(null);
    });

    test("a form for new blogs can be toggled with buttons", async () => {
      nock(testHelper.host)
        .persist()
        .get(testHelper.blogsPath)
        .reply(200, testHelper.blogs);

      const { getByTestId, getByText, getByRole, getByLabelText } = render(
        <App />
      );

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      const showBlogFormBtn = getByText(/blog/i, { selector: "button" });

      fireEvent.click(showBlogFormBtn);
      const blogForm = getByRole("form");
      const authorInput = getByLabelText(/Author/i);
      const hideBlogFormBtn = getByText(/cancel/i, { selector: "button" });
      expect(blogForm).toContainElement(authorInput);
      expect(blogForm).toBeVisible();

      fireEvent.click(hideBlogFormBtn);
      expect(blogForm).not.toBeVisible();
    });

    test("new blogs can be added", async () => {
      const blogId = _times(24, () =>
        ((Math.random() * 0xf) << 0).toString(16)
      ).join("");

      nock(testHelper.host)
        .persist()
        .get(testHelper.blogsPath)
        .reply(200, testHelper.blogs)
        .post(testHelper.blogsPath)
        .reply(200, function(uri, requestBody) {
          const newBlog = {
            ...requestBody,
            likes: 0,
            user: {
              username: testHelper.validLoggedInUser.username,
              name: testHelper.validLoggedInUser.name,
              id: testHelper.validLoggedInUserId,
            },
            id: blogId,
          };

          return newBlog;
        });

      const { getByTestId, getByText, getByLabelText } = render(<App />);

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      const showBlogFormBtn = getByText(/blog/i, { selector: "button" });
      fireEvent.click(showBlogFormBtn);
      const authorInput = getByLabelText(/Author/i);
      const titleInput = getByLabelText(/Title/i);
      const urlInput = getByLabelText(/URL/i);
      const addBtn = getByText(/create|submit|add/i, {
        selector: "*[type='submit']",
      });

      fireEvent.change(authorInput, {
        target: { value: testHelper.validNewBlog.author },
      });

      fireEvent.change(titleInput, {
        target: { value: testHelper.validNewBlog.title },
      });

      fireEvent.change(urlInput, {
        target: { value: testHelper.validNewBlog.url },
      });

      fireEvent.click(addBtn);

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      expect(getByText(testHelper.validNewBlog.title)).toBeInTheDocument();
    });

    test("liking a blog increases it's number of likes", async () => {
      const memberRegex = new RegExp(`${testHelper.blogsPath}/[a-f\\d]{24}`);
      nock(testHelper.host)
        .persist()
        .get(testHelper.blogsPath)
        .reply(200, testHelper.blogs)
        .put(memberRegex)
        .reply(200, function(uri, requestBody) {
          const likedBlog = {
            ...requestBody,
            user: {
              username: blogs[0].username,
              name: blogs[0].name,
              id: blogs[0].id,
            },
          };

          return likedBlog;
        });

      const { getByTestId } = render(<App />);

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      const blogToLike = getByTestId(blogTestIDs[`blog_${blogs[0].id}`]);

      fireEvent.click(blogToLike);
      const likesRegex = new RegExp(`(\\d+)\\s*like(s)?`, "i");
      const likesTxt = within(blogToLike).getByText(likesRegex);
      const likeBtn = within(blogToLike).getByText(/like/i, {
        selector: "button",
      });

      fireEvent.click(likeBtn);

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      const moreLikes = new RegExp(`${blogs[0].likes + 1}\\s*like(s)?`, "i");
      expect(likesTxt).toHaveTextContent(moreLikes);
    });

    test("deleting a blog removes it from the page", async () => {
      const memberRegex = new RegExp(`${testHelper.blogsPath}/[a-f\\d]{24}`);
      nock(testHelper.host)
        .persist()
        .get(testHelper.blogsPath)
        .reply(200, testHelper.blogs)
        .delete(memberRegex)
        .reply(204);

      const { getByTestId } = render(<App />);

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      const blogToDelete = getByTestId(blogTestIDs[`blog_${blogs[0].id}`]);

      fireEvent.click(blogToDelete);

      const deleteBtn = within(blogToDelete).getByText(/delete|remove/i, {
        selector: "button",
      });

      fireEvent.click(deleteBtn);

      await waitForElementToBeRemoved(() =>
        getByTestId(navbarTestIDs.spinnerIcon)
      );

      expect(blogToDelete).not.toBeInTheDocument();
    });
  });
});
