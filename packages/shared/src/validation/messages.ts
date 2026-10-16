import { z } from 'zod';

/**
 * Validation schemas for WebSocket signaling messages
 */

export const AuthMessageSchema = z.object({
  type: z.literal('AUTH'),
  token: z.string().min(1)
});

export const CallOfferSchema = z.object({
  type: z.literal('CALL_OFFER'),
  callId: z.string().min(1),
  payload: z.object({ type: z.string(), sdp: z.string() })
});

export const CallAnswerSchema = z.object({
  type: z.literal('CALL_ANSWER'),
  callId: z.string().min(1),
  payload: z.object({ type: z.string(), sdp: z.string() })
});

export const IceCandidateSchema = z.object({
  type: z.literal('ICE_CANDIDATE'),
  callId: z.string().min(1),
  payload: z.object({}).passthrough()
});

export const CallRequestSchema = z.object({
  type: z.literal('CALL_REQUEST'),
  to: z.string().min(1)
});

export const CallAcceptSchema = z.object({
  type: z.literal('CALL_ACCEPT'),
  callId: z.string().min(1)
});

export const CallRejectSchema = z.object({
  type: z.literal('CALL_REJECT'),
  callId: z.string().min(1),
  reason: z.string().optional()
});

export const CallEndSchema = z.object({
  type: z.literal('CALL_END'),
  callId: z.string().min(1)
});

export const PingSchema = z.object({
  type: z.literal('PING')
});

export const IceRestartSchema = z.object({
  type: z.literal('ICE_RESTART'),
  callId: z.string().min(1),
  payload: z.object({ type: z.string(), sdp: z.string() })
});

export const SignalingMessageSchema = z.discriminatedUnion('type', [
  AuthMessageSchema,
  CallRequestSchema,
  CallAcceptSchema,
  CallOfferSchema,
  CallAnswerSchema,
  IceCandidateSchema,
  CallRejectSchema,
  CallEndSchema,
  PingSchema,
  IceRestartSchema
]);

export type ValidatedSignalingMessage = z.infer<typeof SignalingMessageSchema>;

/**
 * Safely parse and validate a signaling message
 */
export function validateSignalingMessage(data: unknown): ValidatedSignalingMessage | null {
  try {
    return SignalingMessageSchema.parse(data);
  } catch (error) {
    return null;
  }
}
