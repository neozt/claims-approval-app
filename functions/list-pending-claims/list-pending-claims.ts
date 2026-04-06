import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommandOutput, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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
                ':status': 'PENDING_APPROVE',
            },
            ProjectionExpression: '#status, claimId, claimDetails, amount, claimant',
        });

        const result: ScanCommandOutput = await docClient.send(scanItemCommand);

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
