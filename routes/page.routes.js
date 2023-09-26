const path = require("path");
const router = require("express").Router();
const userController = require("../controllers/user.controller");
const accountController = require("../controllers/auth.controller");

const state = {
  conferenceId: "abcd-efg",
};

function renderStaticPage(page) {
  return (req, res) => {
    const file = path.resolve(path.join("public", page));
    return res.status(200).sendFile(file);
  };
}

async function isRoomFull(req, res, next) {
  const totalUsers = await userController.getTotalUser();
  if (totalUsers >= 12)
    return res.status(200).redirect(`/?message=Room is full`);
  return next();
}

//pages
router.get(
  "/",
  accountController.restrictPageAccess(["guest", "user"]),
  renderStaticPage("login.html")
);

router.get(
  "/register",
  accountController.restrictPageAccess(["user"]),
  (req, res) => {
    return res.status(200).render("register.ejs", { account: req.account });
  }
);

/*router.get(
  "/",
  accountController.restrictPageAccess(["guest", "user"]),
  renderStaticPage("index.html")
);

router.post(
  "/",
  accountController.restrictPageAccess(["guest"]),
  isRoomFull,
  async (req, res) => {
    return res
      .status(200)
      .redirect(`/${state.conferenceId}?username=${req.body.username}`);
  }
);*/

router.get(
  "/conferences",
  accountController.restrictPageAccess(["guest", "user"]),
  renderStaticPage("conferences.html")
);

router.get(
  `/conferences/:conferenceId`,
  accountController.restrictPageAccess(["guest", "user"]),
  isRoomFull,
  (req, res) => {
    return res.status(200).render("conference.ejs", {
      account: req.account,
    });
  }
  /*(req, res) => {
    const file = path.resolve(path.join("public", "conference.html"));
    return res.status(200).sendFile(file);
  }*/
);

module.exports = router;
