const { Router } = require("express");

const authenticator = require("./authenticator");
const validator = require("./validator");
const controller = require("./controller");

const router = new Router();

//for Authenticated users
router.post(
  "/create-invoice",
  authenticator.verify_client,
  validator.createInvoice,
  controller.createInvoice
);

router.post(
  "/get-invoice",
  authenticator.verify_client_all,
  validator.getInvoice,
  controller.getInvoice
);

router.post("/notify/:projectName", controller.notify);

module.exports = router;
