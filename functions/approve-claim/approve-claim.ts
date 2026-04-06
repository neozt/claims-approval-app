import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const sfnClient = new SFNClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event));

    try {
        const claimId = event.pathParameters?.claimId;

        const path = event.rawPath || event.path || '';
        const isApproval = path.includes('/approve');
        const isRejection = path.includes('/reject');

        if (!isApproval && !isRejection) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({ message: 'Invalid endpoint. Use /approve or /reject.' }),
            };
        }

        if (!claimId) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({ message: 'Missing claimId in path.' }),
            };
        }

        const tableName = process.env.DYNAMODB_TABLE_NAME;
        const getItemCommand = new GetCommand({
            TableName: tableName,
            Key: {
                claimId: claimId,
            },
        });

        const ddbResult = await docClient.send(getItemCommand);

        const taskToken = ddbResult.Item?.taskToken;

        if (!taskToken) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({ message: 'Claim not found or task token missing.' }),
            };
        }

        if (isApproval) {
            const output = JSON.stringify({
                status: 'APPROVED',
                approverEmail: 'manager@company.com', // TODO
                decisionDate: new Date().toISOString(),
            });

            await sfnClient.send(
                new SendTaskSuccessCommand({
                    taskToken: taskToken,
                    output: output,
                }),
            );

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({
                    message: 'Claim has been approved.',
                    claimId: claimId,
                }),
            };
        } else {
            const output = JSON.stringify({
                status: 'REJECTED',
                approverEmail: 'manager@company.com', // TODO
                decisionDate: new Date().toISOString(),
            });

            await sfnClient.send(
                new SendTaskSuccessCommand({
                    taskToken: taskToken,
                    output: output,
                }),
            );

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({
                    message: 'Claim has been rejected.',
                    claimId: claimId,
                }),
            };
        }
    } catch (error) {
        console.error('Step Function Callback Error:', error);

        // Handle common SFN errors (e.g., TaskAlreadyCompleted or InvalidToken)
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({
                message: 'The link may have expired or already been processed',
            }),
        };
    }
};
