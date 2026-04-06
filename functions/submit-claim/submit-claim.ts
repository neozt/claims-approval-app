import { SendTaskSuccessCommand, SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const sfnClient = new SFNClient({});

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event));

    try {
        const claimId = crypto.randomUUID();

        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch (e) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({
                    message: 'Request body cannot be empty',
                }),
            };
        }
        const amount = requestBody?.amount;
        const claimant = requestBody?.claimant;

        if (amount === undefined || amount === null || !claimant) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({
                    message: 'amount or claimant is missing',
                }),
            };
        }

        const input = {
            claimId,
            amount,
            claimant,
            submittedAt: new Date().toISOString(),
        };

        const commandInput = {
            stateMachineArn: process.env.STATE_MACHINE_ARN,
            name: claimId,
            input: JSON.stringify(input),
        };

        console.log('Start step function execution with input: ', input);

        const command = new StartExecutionCommand(commandInput);
        const response = await sfnClient.send(command);

        console.log('Successfully started step function execution with claimId: ', claimId);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({
                message: 'Successfully submitted claim',
                claimId: claimId,
            }),
        };
    } catch (error) {
        console.error('Error when submitting claims: ', error);

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
