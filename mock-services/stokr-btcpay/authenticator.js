const { ObjectId } = require("mongodb");

const config = require("../config/config");
const jwtApi = require("../libs/jwt-module");
const stokrDB = require("../libs/stokr-db");
const UserTypes = require("../libs/user-types");

// SA user type is always allowed

const checkHeader = async (req) => {
  const userId = req.headers["userid"];
  if (req.headers["gatewaypassed"] === "ok" && userId) {
    req.user = await stokrDB("users").findOne({ _id: new ObjectId(userId) });
  }
  return !!req.user;
};

const checkClientSignature = async (req) => {
  if (req.headers["client_signature"]) {
    const jwtToken = req.headers["client_signature"];
    req.client_signature = await jwtApi.verify(
      jwtToken,
      config.internalApi.jwtOptions
    );
  }
  return !!req.client_signature;
};

exports.stokrAdmins = async (req, res, next) => {
  if (
    !(await checkHeader(req)) ||
    (req.user.user_type !== UserTypes.SA &&
      req.user.user_type !== UserTypes.ADMIN_OPERATIONS &&
      req.user.user_type !== UserTypes.SA_READONLY)
  ) {
    res.status(406).send("E_PERMISSION_ADMINS");
    return;
  }
  next();
};

exports.stokrAdminsAndcompanyAdmins = async (req, res, next) => {
  if (
    !(await checkHeader(req)) ||
    (req.user.user_type !== UserTypes.COMPANY_SA &&
      req.user.user_type !== UserTypes.COMPANY_PA &&
      req.user.user_type !== UserTypes.SA &&
      req.user.user_type !== UserTypes.ADMIN_OPERATIONS &&
      req.user.user_type !== UserTypes.SA_READONLY &&
      req.user.user_type !== UserTypes.INTERNAL_API_USER)
  ) {
    res.status(406).send("E_PERMISSION_ADMINS");
    return;
  }
  next();
};

exports.company_sa = async (req, res, next) => {
  if (
    !(await checkHeader(req)) ||
    (req.user.user_type !== UserTypes.COMPANY_SA &&
      req.user.user_type !== UserTypes.SA)
  ) {
    res.status(406).send("E_PERMISSION_COMPANY_SA");
    return;
  }
  next();
};

exports.admin_operations = async (req, res, next) => {
  if (
    (!(await checkHeader(req)) || req.user.user_type !== UserTypes.SA,
    req.user.user_type !== UserTypes.ADMIN_OPERATIONS)
  ) {
    res.status(406).send("E_PERMISSION_ADMIN_OPERATIONS");
    return;
  }
  next();
};

exports.sa = async (req, res, next) => {
  if (!(await checkHeader(req)) || req.user.user_type !== UserTypes.SA) {
    res.status(406).send("E_PERMISSION_SA");
    return;
  }
  next();
};

exports.all = async (req, res, next) => {
  if (!(await checkHeader(req))) {
    res.status(406).send("E_PERMISSION_ALL");
    return;
  }
  next();
};

exports.verify_client = async (req, res, next) => {
  if (
    !(await checkClientSignature(req)) &&
    (!(await checkHeader(req)) || req.user.user_type !== UserTypes.SA)
  ) {
    res.status(403).send("E_CLIENT_CERTS");
    return;
  }
  next();
};

exports.verify_client_all = async (req, res, next) => {
  if (!(await checkClientSignature(req)) && !(await checkHeader(req))) {
    res.status(403).send("E_CLIENT_CERTS::E_AUTH");
    return;
  }
  next();
};
