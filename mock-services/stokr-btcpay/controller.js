const { ObjectId } = require("mongodb");

const config = require("../config/config");
const log = require("../libs/log");
const stokrDB = require("../libs/stokr-db");
const internalApi = require("../libs/internal-api");
const btcpay = require("../libs/btcpay-api");

const getInvestment = async (investmentId) => {
  const investment = await stokrDB("investment").findOne({ _id: investmentId });
  if (!investment) {
    throw new Error(`Investment "${investmentId}" not found`, {
      cause: { status: 404, response: "E_OBJ_NOTFOUND::investment" },
    });
  }
  return investment;
};

const getPaymentMethods = (investment) => {
  switch (investment.currencyType) {
    case "bitcoin":
    case "btc-fb":
      return ["BTC"];
    case "lbtc":
      return ["LBTC"];
  }
  throw new Error(`No payment methods for "${investment.currencyType}" found`, {
    cause: { status: 500, response: "E_OBJ::investment.currencyType" },
  });
};

const getProject = async (projectId) => {
  const project = await stokrDB("projects").findOne({ _id: projectId });
  if (!project) {
    throw new Error(`Project "${projectId}" not found`, {
      cause: { status: 404, response: "E_OBJ_NOTFOUND::project" },
    });
  }
  return project;
};

const getNotificationUrl = (investmentId) => {
  const url = new URL(config.links.notification_cb_baseurl);
  url.searchParams.append("investmentId", investmentId.toString());
  url.searchParams.append("internal_token_v0", config.btcpay.INTERNAL_TOKEN_V0);
  return url.href;
};

const getRedirectUrl = (projectName, investmentId) => {
  const url = new URL(
    `/${projectName}/success`,
    config.links.investmentflow_baseurl
  );
  url.searchParams.append("investmentId", investmentId.toString());
  return url.href;
};

exports.createInvoice = async (req, res) => {
  const { investmentId } = req.body;
  try {
    const investment = await getInvestment(investmentId);
    const paymentMethods = getPaymentMethods(investment);
    const project = await getProject(new ObjectId(investment.project));
    const notificationUrl = getNotificationUrl(investmentId);
    const redirectUrl = getRedirectUrl(project.name, investmentId);
    const invoice = await btcpay.createInvoice(project.name, {
      metadata: {
        orderId: investmentId.toString(),
        orderUrl: notificationUrl,
        itemDesc: req.body.itemDesc || "",
        posData: {},
        receiptData: {},
      },
      checkout: {
        speedPolicy: "LowSpeed",
        paymentMethods,
        defaultPaymentMethod: paymentMethods[0],
        lazyPaymentMethods: true,
        expirationMinutes: 90,
        monitoringMinutes: 90,
        paymentTolerance: 0,
        redirectURL: redirectUrl,
        redirectAutomatically: true,
        defaultLanguage: "de",
      },
      receipt: {
        enabled: true,
        showQR: null,
        showPayments: null,
      },
      amount: parseFloat(investment.currencyAmount),
      currency: "BTC",
      additionalSearchTerms: [],
    });
    const activationSuccess = await btcpay.activatePaymentMethod(
      project.name,
      invoice.id,
      "BTC-CHAIN"
    );
    if (!activationSuccess) {
      log.error(
        `Failed to activate BTC payment method for invoice "${invoice.id}"`
      );
      return res
        .status(500)
        .send("E_INTERNAL:Failed to activate BTC payment method");
    }
    const btcInvoicePayMethod = (
      await btcpay.getInvoicePaymentMethods(project.name, invoice.id)
    ).find((pm) => pm.paymentMethodId === "BTC-CHAIN");

    if (!btcInvoicePayMethod) {
      log.error(
        `No BTC-CHAIN payment method found for invoice "${invoice.id}"`
      );
      //return res.status(500).send("E_INTERNAL:No BTC payment method found");
    }

    const bip44Index =
      btcInvoicePayMethod?.additionalData?.keyPath?.split("/")[1];
    const btcAddress = btcInvoicePayMethod?.destination;
    const recommendedFeeRate =
      btcInvoicePayMethod?.additionalData?.recommendedFeeRate;

    if (!btcAddress) {
      log.error(`No BTC address found for invoice "${invoice.id}"`);
      return res.status(500).send("E_INTERNAL:No BTC address found");
    }
    // Uncomment the following lines on PROD to register the BTC address in Fireblocks
    /*     const registeredBtcResponse = internalApi.registerBtcAddressInFireblocks({
      projectName: project.name,
      bip44Index,
      btcAddress,
    });
    if (!registeredBtcResponse.success) {
      log.error(
        `Failed to register BTC address "${btcAddress}" for project "${project.name}" with index "${bip44Index}" in Fireblocks message: "${registeredBtcResponse.message}"`
      );
      return res
        .status(500)
        .send("E_INTERNAL:Failed to register BTC address in Fireblocks");
    } */

    log.debug(`Invoice "${invoice.id} created`);
    res.json({
      btcpayInvoiceId: invoice.id,
      url: invoice.url,
      destinationAddress: btcAddress,
      recommendedFeeRate,
    });
  } catch (error) {
    log.error(error.stack);
    res
      .status(error.cause?.status || 500)
      .send(error.cause?.response || "E_INTERNAL");
  }
};

exports.getInvoice = async (req, res) => {
  const { investmentId } = req.body;
  try {
    const investment = await getInvestment(investmentId);
    const invoiceId = investment.btcpayInvoiceId;
    const project = await getProject(new ObjectId(investment.project));
    const invoice = await btcpay.getInvoice(project.name, invoiceId);
    res.json(invoice);
  } catch (error) {
    log.error(error.stack);
    res
      .status(error.cause?.status || 500)
      .send(error.cause?.response || "E_INTERNAL");
  }
};

exports.notify = async (req, res) => {
  const projectName = req.params.projectName;
  const store = await btcpay.getStore(projectName);
  const invoiceId = req.body.data.id;

  switch (req.body.event.name) {
    case "invoice_created":
    case "invoice_expired":
    case "invoice_isProcessing":
    case "invoice_becameInvalid":
      log.info(
        `Received event "${req.body.event.name}" for invoice "${invoiceId}"`
      );
      break;

    case "invoice_expiredPaidPartial":
      await internalApi.sendEmailToAdmin(
        `BTCPay: Invoice expired partially paid`,
        `The invoice with ID "${invoiceId}" has expired and was partially paid for project ${projectName}.please check`,
        "lukas@stokr.io"
      );
      log.info(
        `Received event "${req.body.event.name}" for invoice "${invoiceId}"`
      );
      await storeEvent(projectName, store, req.body.event);
      break;
    case "invoice_expiredPaidLate":
      await internalApi.sendEmailToAdmin(
        `BTCPay: Invoice expired paid late`,
        `The invoice with ID "${invoiceId}" has expired and was paid late for project ${projectName}. Please check.`,
        "lukas@stokr.io"
      );
      log.info(
        `Received event "${req.body.event.name}" for invoice "${invoiceId}"`
      );
      await storeEvent(projectName, store, req.body.event);
      break;
    case "invoice_paymentSettled":
      {
        log.info(
          `Received event "${req.body.event.name}" for invoice "${req.body.event.data.id}"`
        );
      }
      await storeEvent(projectName, store, req.body.event);
      break;
    case "invoice_receivedPayment":
      {
        await storeEvent(projectName, store, req.body.event);
        await handleReceivedPayment(projectName, invoiceId);
        log.info(`Received payment for invoice "${invoiceId}"`);
      }
      break;

    case "invoice_isSettled":
      {
        await storeEvent(projectName, store, req.body.event);
        await handleSettledInvoice(projectName, invoiceId);
        log.info(`Invoice "${invoiceId}" has settled`);
      }
      break;
    default:
      log.warn(
        `Unhandled event "${req.body.event.name}" for invoice "${invoiceId}"`
      );
      break;
  }

  const investmentId = req.body.metadata?.orderId;
  if (!investmentId) {
    throw new Error("No investmentId in callback metadata");
  }

  res.sendStatus(200);
};

const storeEvent = async (projectName, store, event) => {
  try {
    await stokrDB("btcpay_callbacks").insertOne({
      projectName,
      store,
      event,
    });
  } catch (error) {
    log.error(
      `Failed to store event for project "${projectName}": ${error.message}`
    );
  }
};

const handleSettledInvoice = async (projectName, invoiceId) => {
  const invoice = await btcpay.getInvoice(projectName, invoiceId);
  const investmentId = invoice.metadata?.orderId;
  const investment = await getInvestment(new ObjectId(investmentId));
  const project = await getProject(new ObjectId(investment.project));
  if (invoice.status == "Settled") {
    log.info(`Invoice "${invoice.id}" has settled`);
    const paymentMethods = await btcpay.getInvoicePaymentMethods(
      project.name,
      invoice.id
    );
    const payments = paymentMethods[0].payments
      .filter((payment) => payment.status === "Settled")
      .map((payment) => ({
        userId: investment.creator,
        investmentId,
        txType: "subscription",
        status: "success",
        amount: payment.value,
        sender: investment.creator,
        recipient: investment.project,
        currencyType: investment.currencyType,
        date: new Date(payment.receivedDate * 1000).toISOString(),
        channel: "btc_pay",
        cryptoDetails: {
          txHash: payment.id.split("-")[0],
          vout: parseInt(payment.id.split("-")[1]),
          destination: payment.destination,
        },
      }));

    await internalApi.markInvestmentAsPaid(investmentId, payments);
    if (project.type !== "fund") {
      await internalApi.createAssetAssignment(investmentId);
    }
  }
};

const handleReceivedPayment = async (projectName, invoiceId) => {
  const paymentInfo = await btcpay.getInvoicePaymentMethods(
    projectName,
    invoiceId
  );
  const isFirstPayment = paymentInfo[0].payments.length === 1;
  if (!isFirstPayment) {
    return;
  }
  const invoice = await btcpay.getInvoice(projectName, invoiceId);
  const investmentId = invoice.metadata?.orderId;
  const investment = await getInvestment(new ObjectId(investmentId));
  await internalApi.addAddressOwnershipProof({
    userId: investment.creator,
    address: paymentInfo[0].payments[0].destination,
    chainType: "bitcoin",
    proofType: "transaction",
    witness: paymentInfo[0].payments[0].id,
    investmentId,
  });
};
