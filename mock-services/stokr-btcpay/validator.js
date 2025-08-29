const joi = require("joi");
const { ObjectId } = require("mongodb");

const logMW = require("../libs/logging-middleware");

const validateRequest = (prop, schema) => (req, res, next) => {
  const { error, value } = schema.validate(req[prop], { abortEarly: false });
  if (error) {
    const msg = error.details.map((detail) => detail.message).join(", ");
    //log.debug(`${req.method} ${req.originalUrl}: ${msg}`);
    logMW.error(
      `PARAMETERS INCORRECT: ${req.method} ${req.originalUrl}: ${msg}`,
    );
    return res.status(406).send(`E_PARAMETERS_INCORRECT: ${msg}`);
  }
  req[prop] = value;
  next();
};
const validateRequestBody = (schema) => validateRequest("body", schema);
const validateRequestQuery = (schema) => validateRequest("query", schema);

exports.createInvoice = validateRequestBody(
  joi.object().keys({
    investmentId: joi.custom((value) => new ObjectId(value)).required(),
  }),
);

exports.getInvoice = validateRequestBody(
  joi.object().keys({
    investmentId: joi.custom((value) => new ObjectId(value)).required(),
  }),
);

exports.notify = validateRequestQuery(
  joi.object().keys({
    investmentId: joi.custom((value) => new ObjectId(value)).required(),
    internal_token_v0: joi.string().required(),
  }),
);
