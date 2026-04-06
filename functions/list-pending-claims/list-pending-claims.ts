import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event));

    try {
        const tableName = process.env.DYNAMODB_TABLE_NAME;
        const scanItemCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':status': {
                    S: 'PENDING_APPROVE',
                },
            },
            ProjectionExpression: '#status, claimId, claimDetails, amount, claimant',
        });

        const result = await dynamoClient.send(scanItemCommand);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({
                data: result?.Items,
            }),
        };
    } catch (error) {
        console.error('Error when listing pending claims: ', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({
                message: 'Something went wrong. Please try again later.',
            }),
        };
    }
};
