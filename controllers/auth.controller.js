const crypto = require("crypto");
const ethers = require("ethers");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const AccountModel = require("../models/Account.Model");

const tools = require("../utils/tools");

exports.getNonce = async (req, res) => {
  try {
    var userAccount = await AccountModel.findOne({ address: req.body.address })
      .select("nonce")
      .lean();
    //create new account and generate nonce
    if (!userAccount) {
      userAccount = await AccountModel.create({
        address: req.body.address,
        nonce: crypto.randomBytes(32).toString("hex"),
        createdAt: Date.now(),
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        nonce: userAccount.nonce,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: err.statusCode ? "fail" : "error",
      message: err.message,
    });
  }
};

exports.authenticate = async (req, res, next) => {
  try {
    const { signedMessage, message, address } = req.body;
    const recoveredAddress = ethers.verifyMessage(message, signedMessage);
    if (recoveredAddress.toUpperCase() !== address.toUpperCase())
      throw { statusCode: 401, message: "Invalid signature" };
    req.payload = { address: address, role: "user" };
    return next();
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: err.statusCode ? "fail" : "error",
      message: err.message,
    });
  }
};

exports.guestAuthenticate = async (req, res, next) => {
  if (!req.body.firstName) {
    return res.status(200).json({
      status: "fail",
      message: "Please provide your name!",
    });
  }
  req.payload = {
    _id: new mongoose.Types.ObjectId(),
    firstName: req.body.firstName,
    role: "guest",
  };
  return next();
};

exports.createAuthenticationToken = async (req, res, next) => {
  try {
    // Generate the JWT token
    const token = jwt.sign(req.payload, process.env.TOKEN_SECRET, {
      expiresIn: `${process.env.TOKEN_EXPIRES_IN}s`,
    });
    // Set the token in a cookie with the same expiry as the token
    return res
      .status(200)
      .cookie("token", token, {
        maxAge: process.env.TOKEN_EXPIRES_IN * 1000,
        httpOnly: true,
      })
      .json({
        status: "authorized",
      });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: err.statusCode ? "fail" : "error",
      message: err.message,
    });
  }
};

/**
 * @method helper
 * @description validate token
 */

async function validateToken(token, roles) {
  const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

  if (!roles.includes(decoded.role))
    throw { statusCode: 401, message: "Permission denied!" };

  var account = null,
    registered = true;
  if (decoded.role === "user") {
    // User Account
    account = await AccountModel.findOne({
      address: decoded.address,
    }).lean();
    registered = !tools.isEmpty(account, ["firstName", "lastName"]);
  } else {
    account = {
      _id: decoded._id,
      firstName: decoded?.firstName,
    };
  }

  //account payload
  return {
    _id: account?._id,
    firstName: account?.firstName,
    lastName: account?.lastName,
    address: account?.address,
    role: decoded.role,
    registered,
  };
}

exports.restrictPageAccess = (roles) => {
  return async (req, res, next) => {
    try {
      const token = req.cookies.token;
      //if user not logged in redirect to login page
      if (req.path === "/" && !token) return next();
      //validate user token
      req.account = await validateToken(token, roles);
      //check user registeration is completed or not
      if (req.path !== "/register" && !req.account.registered)
        return res.status(200).redirect("/register");

      if (req.path === "/") return res.status(200).redirect("/conferences");

      return next();
    } catch (err) {
      return res
        .status(401)
        .cookie("token", "", { maxAge: 0 })
        .redirect(`/?message=${err.message}`);
    }
  };
};

exports.restrictApiAccess = (roles) => {
  return async (req, res, next) => {
    try {
      const token = req.cookies.token;
      if (!token) throw { statusCode: 401, message: "Please login" };
      req.account = await validateToken(token, roles);
      return next();
    } catch (err) {
      return res.status(err.statusCode || 500).json({
        status: err.statusCode ? "fail" : "error",
        message: err.message,
      });
    }
  };
};

exports.updateAccount = async (req, res) => {
  try {
    await AccountModel.updateOne(
      { _id: req.account._id },
      { firstName: req.body.firstName, lastName: req.body.lastName }
    );
    return res.status(200).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: err.statusCode ? "fail" : "error",
      message: err.message,
    });
  }
};

exports.logout = async (req, res) => {
  return res.status(200).cookie("token", "", { maxAge: 0 }).json({status:"fail"});
};
