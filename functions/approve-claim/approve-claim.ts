import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const sfnClient = new SFNClient({});
const dynamoClient = new DynamoDBClient({});

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
        const getItemCommand = new GetItemCommand({
            TableName: tableName,
            Key: {
                claimId: { S: claimId },
            },
        });

        const ddbResult = await dynamoClient.send(getItemCommand);

        if (!ddbResult.Item || !ddbResult.Item.taskToken || !ddbResult.Item.taskToken.S) {
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

        const taskToken = ddbResult.Item.taskToken.S;

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
