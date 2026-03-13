import { handler } from '../approve-claims.mjs';
import { SFNClient, SendTaskSuccessCommand } from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { jest } from '@jest/globals';

const sfnMock = mockClient(SFNClient);

describe('approve-claims handler', () => {
    let dateSpy;

    beforeEach(() => {
        sfnMock.reset();
        
        // Mock Date to ensure deterministic outputs for tests
        const mockDate = new Date('2026-03-13T14:55:01.000Z');
        dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        dateSpy.now = jest.fn(() => mockDate.getTime());
    });

    afterEach(() => {
        dateSpy.mockRestore();
    });

    it('should return 400 if taskToken is missing', async () => {
        const event = {
            queryStringParameters: {}
        };
        const result = await handler(event);
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Missing taskToken in query string.');
    });

    it('should approve path including /approve', async () => {
        sfnMock.on(SendTaskSuccessCommand).resolves({});

        const event = {
            queryStringParameters: { token: 'sample-token' },
            rawPath: '/approve'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toContain('Success');
        expect(result.body).toContain('Expense Approved');

        // Verify that sfnMock was called with the correct arguments
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
        sfnMock.on(SendTaskSuccessCommand).resolves({});

        const event = {
            queryStringParameters: { token: 'sample-token' },
            path: '/api/reject'
        };

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toContain('Rejected');
        expect(result.body).toContain('Expense Declined');

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
        const event = {
            queryStringParameters: { token: 'sample-token' },
            rawPath: '/other'
        };

        const result = await handler(event);
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body).message).toBe('Invalid endpoint. Use /approve or /reject.');
    });

    it('should return 500 on SFNClient error', async () => {
        const mockError = new Error('TaskAlreadyCompleted');
        mockError.name = 'TaskAlreadyCompleted';
        sfnMock.on(SendTaskSuccessCommand).rejects(mockError);

        const event = {
            queryStringParameters: { token: 'sample-token' },
            rawPath: '/approve'
        };

        const result = await handler(event);
        expect(result.statusCode).toBe(500);
        expect(result.body).toContain('Error');
        expect(result.body).toContain('TaskAlreadyCompleted: The link may have expired or already been processed.');
    });
});
