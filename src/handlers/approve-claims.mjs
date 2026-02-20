import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from "@aws-sdk/client-sfn";

const sfnClient = new SFNClient({});

export const handler = async (event) => {
    console.log("Received event:", JSON.stringify(event));

    try {
        // 1. Extract the token from query parameters
        const taskToken = event.queryStringParameters?.token;

        // 2. Identify the action based on the URL path
        // Supports both REST API (event.path) and HTTP API (event.rawPath)
        const path = event.rawPath || event.path || "";
        const isApproval = path.includes("approve");
        const isRejection = path.includes("reject");

        if (!taskToken) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing taskToken in query string." }),
            };
        }

        // 3. Branching Logic
        if (isApproval) {
            const output = JSON.stringify({
                status: "APPROVED",
                approverEmail: "manager@company.com", // In a real app, extract from a JWT/Session
                decisionDate: new Date().toISOString()
            });

            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: output
            }));

            return respondHtml("Success", "Expense Approved", "#2ecc71");
        }

        else if (isRejection) {
            await sfnClient.send(new SendTaskFailureCommand({
                taskToken: taskToken,
                error: "ManagerRejectedException",
                cause: "The manager clicked the rejection link in the automated email."
            }));

            return respondHtml("Rejected", "Expense Declined", "#e74c3c");
        }

        // 4. Fallback for unknown paths
        return {
            statusCode: 404,
            body: JSON.stringify({ message: "Invalid endpoint. Use /approve or /reject." }),
        };

    } catch (error) {
        console.error("Step Function Callback Error:", error);

        // Handle common SFN errors (e.g., TaskAlreadyCompleted or InvalidToken)
        return {
            statusCode: 500,
            headers: { "Content-Type": "text/html" },
            body: `<html><body><h2>Error</h2><p>${error.name}: The link may have expired or already been processed.</p></body></html>`
        };
    }
};

/**
 * Helper to return a simple, styled HTML response for the manager's browser
 */
function respondHtml(title, message, color) {
    return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: `
            <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h1 style="color: ${color};">${title}</h1>
                    <p>${message}</p>
                    <small style="color: #666;">You can safely close this tab now.</small>
                </body>
            </html>
        `
    };
}
