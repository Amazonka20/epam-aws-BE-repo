exports.basicAuthorizer = async (event) => {
  console.log("Incoming event:", JSON.stringify(event));

  try {
    const { authorizationToken, methodArn } = event || {};
    if (!authorizationToken) {
      console.warn("No Authorization header");
      throw new Error("Unauthorized"); 
    }

    const encoded = authorizationToken.split(" ")[1];
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [login, password] = decoded.split(":");

    console.log("Decoded credentials:", login, password);
    console.log("Available ENV keys:", Object.keys(process.env));

    const expectedPassword = process.env[login];
    console.log("Expected password:", expectedPassword);

    if (!expectedPassword) {
      console.warn("Login not found in environment");
      return generatePolicy(login || "unknown", "Deny", methodArn);
    }

    const effect = expectedPassword === password ? "Allow" : "Deny";
    console.log(`Auth result for ${login}: ${effect}`);

    return generatePolicy(login || "unknown", effect, methodArn);
  } catch (err) {
    console.error("Error in basicAuthorizer:", err.message, err.stack);
    if (err.message === "Unauthorized") throw err;
    return generatePolicy("unknown", "Deny", event?.methodArn || "*");
  }
};

function generatePolicy(principalId, effect, resource) {
  console.log(`Generating policy: ${effect} for ${resource}`);
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}
