import { handler } from '../approve-claim';
import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { jest } from '@jest/globals';
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const sfnMock = mockClient(SFNClient);
const docMock = mockClient(DynamoDBDocumentClient);

describe('approve-claim handler', () => {
    let dateSpy;

    beforeEach(() => {
        sfnMock.reset();
        docMock.reset();

        process.env.DYNAMODB_TABLE_NAME = 'MockTable';

        // Mock Date to ensure deterministic outputs for tests
        const mockDate = new Date('2026-03-13T14:55:01.000Z');
        dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        dateSpy.now = jest.fn(() => mockDate.getTime());
    });

    afterEach(() => {
        dateSpy.mockRestore();
        delete process.env.DYNAMODB_TABLE_NAME;
    });

    it('should return 400 if claimId is missing', async () => {
        const event = {
            pathParameters: {},
            rawPath: '/approve/any',
        };
        const result = await handler(event);
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Missing claimId in path.');
    });

    it('should return 404 if claim is not found in DDB', async () => {
        docMock.on(GetCommand).resolves({});

        const event = {
            pathParameters: {claimId: 'non-existent'},
            rawPath: '/approve/non-existent',
        };

        const result = await handler(event);
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).message).toBe('Claim not found or task token missing.');
    });

    it('should approve path including /approve', async () => {
        docMock.on(GetCommand).resolves({
            Item: {
                taskToken: 'sample-token',
            },
        });
        sfnMock.on(SendTaskSuccessCommand).resolves({});

        const event = {
            pathParameters: {claimId: '12345'},
            rawPath: '/approve/12345',
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toContain('Claim has been approved.');

        const calls = sfnMock.commandCalls(SendTaskSuccessCommand);
        expect(calls.length).toBe(1);
        const args = calls[0].args[0].input;
        expect(args.taskToken).toBe('sample-token');
        const output = JSON.parse(args.output);
        expect(output.status).toBe('APPROVED');
        expect(output.approverEmail).toBe('manager@company.com');
        expect(output.decisionDate).toBe('2026-03-13T14:55:01.000Z');
    });

    it('should reject path including /reject', async () => {
        docMock.on(GetCommand).resolves({
            Item: {
                taskToken: 'sample-token',
            },
        });
        sfnMock.on(SendTaskSuccessCommand).resolves({});

        const event = {
            pathParameters: {claimId: '12345'},
            path: '/reject/12345',
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toContain('Claim has been rejected.');

        const calls = sfnMock.commandCalls(SendTaskSuccessCommand);
        expect(calls.length).toBe(1);
        const args = calls[0].args[0].input;
        expect(args.taskToken).toBe('sample-token');
        const output = JSON.parse(args.output);
        expect(output.status).toBe('REJECTED');
        expect(output.approverEmail).toBe('manager@company.com');
        expect(output.decisionDate).toBe('2026-03-13T14:55:01.000Z');
    });

    it('should return 404 for invalid endpoint', async () => {
        docMock.on(GetCommand).resolves({
            Item: {
                taskToken: 'sample-token',
            },
        });

        const event = {
            pathParameters: {claimId: '12345'},
            rawPath: '/other/12345',
        };

        const result = await handler(event);
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).message).toBe('Invalid endpoint. Use /approve or /reject.');
    });

    it('should return 500 on SFNClient error', async () => {
        docMock.on(GetCommand).resolves({
            Item: {
                taskToken: 'sample-token',
            },
        });

        const mockError = new Error('TaskAlreadyCompleted');
        mockError.name = 'TaskAlreadyCompleted';
        sfnMock.on(SendTaskSuccessCommand).rejects(mockError);

        const event = {
            pathParameters: {claimId: '12345'},
            rawPath: '/approve/12345',
        };

        const result = await handler(event);
        expect(result.statusCode).toBe(404);
        expect(result.body).toContain('The link may have expired or already been processed');
    });
});
