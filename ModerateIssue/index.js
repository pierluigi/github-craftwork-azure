// Set these in your Azure Function Application Settings
const appId = process.env["APP_ID"] || "";
// Decode our secret pem file
const pem = Buffer.from(process.env["APP_PEM"] || "", "base64").toString();

const octokit = require("@octokit/rest")();
const jsonwebtoken = require("jsonwebtoken");

function generateJwtToken() {
  // Sign with RSA SHA256
  return jsonwebtoken.sign(
    {
      iat: Math.floor(new Date() / 1000),
      exp: Math.floor(new Date() / 1000) + 60,
      iss: appId
    },
    pem,
    { algorithm: "RS256" }
  );
}

async function postIssueComment(
  installationId,
  owner,
  repository,
  number,
  action
) {
  // Create bearer token and initial authentication session
  await octokit.authenticate({
    type: "app",
    token: generateJwtToken()
  });

  // Retrieve token from app installation
  const {
    data: { token }
  } = await octokit.apps.createInstallationToken({
    installation_id: installationId
  });

  // Finally authenticate as the app
  octokit.authenticate({ type: "token", token });

  var result = await octokit.issues.createComment({
    owner,
    repo: repository,
    number,
    body: `Just changing the message for fun!`
  });
  return result;
}

module.exports = async function(context, data) {
  const body = data.body;
  const action = body.action;
  const number = body.issue.number;
  const repository = body.repository.name;
  const owner = body.repository.owner.login;
  const installationId = body.installation.id;

  try {
    var response = "";
    if (action === "opened") {
      response = await postIssueComment(
        installationId,
        owner,
        repository,
        number,
        action
      );
    }
    context.res = {
      status: 200,
      body: response,
      headers: {
        "Content-Type": "application/json"
      }
    };
  } catch (e) {
    context.log(e);
    context.res = {
      status: 500,
      body: e.message
    };
  }
};
