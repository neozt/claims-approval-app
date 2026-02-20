import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";

const sfnClient = new SFNClient({});

export const handler = async (event) => {
    console.log("Received event:", JSON.stringify(event));

    try {
        const taskToken = event.queryStringParameters?.token;

        const path = event.rawPath || event.path || "";
        const isApproval = path.includes("/approve");
        const isRejection = path.includes("/reject");

        if (!taskToken) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing taskToken in query string." }),
            };
        }

        if (isApproval) {
            const output = JSON.stringify({
                status: "APPROVED",
                approverEmail: "manager@company.com", // TODO
                decisionDate: new Date().toISOString()
            });

            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: output
            }));

            return respondHtml("Success", "Expense Approved", "#2ecc71");
        } else if (isRejection) {
            const output = JSON.stringify({
                status: "REJECTED",
                approverEmail: "manager@company.com", // TODO
                decisionDate: new Date().toISOString()
            });

            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: output
            }));

            return respondHtml("Rejected", "Expense Declined", "#e74c3c");
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Invalid endpoint. Use /approve or /reject." }),
            };
        }
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
