const router = require("express").Router();

const authController = require("../../controllers/auth.controller");

router.post("/nonce", authController.getNonce);
router.post(
  "/authenticate",
  authController.authenticate,
  authController.createAuthenticationToken
);
router.post(
  "/authenticate:guest",
  authController.guestAuthenticate,
  authController.createAuthenticationToken
);
router.patch(
  "/account:update",
  authController.restrictApiAccess(["user"]),
  authController.updateAccount
);

router.get("/logout", authController.logout);

module.exports = router;
