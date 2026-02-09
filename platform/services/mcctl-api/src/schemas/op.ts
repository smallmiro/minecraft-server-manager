import { Type, Static } from '@sinclair/typebox';

/**
 * OP Level schemas for API
 */

// Operator info with level
export const OperatorInfoSchema = Type.Object({
  name: Type.String(),
  uuid: Type.String(),
  level: Type.Integer({ minimum: 1, maximum: 4 }),
  role: Type.String(), // Moderator, Gamemaster, Admin, Owner
  bypassesPlayerLimit: Type.Boolean(),
});

// Operators list response
export const OperatorsListResponseSchema = Type.Object({
  operators: Type.Array(OperatorInfoSchema),
  count: Type.Number(),
  source: Type.Optional(
    Type.Union([Type.Literal('rcon'), Type.Literal('file'), Type.Literal('config')])
  ),
});

// Add operator request (with optional level)
export const AddOperatorRequestSchema = Type.Object({
  player: Type.String({ minLength: 1, maxLength: 16 }),
  level: Type.Optional(Type.Integer({ minimum: 1, maximum: 4, default: 4 })),
});

// Update operator level request
export const UpdateOperatorLevelRequestSchema = Type.Object({
  level: Type.Integer({ minimum: 1, maximum: 4 }),
});

// Operator action response
export const OperatorActionResponseSchema = Type.Object({
  success: Type.Boolean(),
  operator: Type.Optional(OperatorInfoSchema),
  message: Type.Optional(Type.String()),
  source: Type.Optional(
    Type.Union([Type.Literal('rcon'), Type.Literal('file'), Type.Literal('config')])
  ),
});

// Type exports
export type OperatorInfo = Static<typeof OperatorInfoSchema>;
export type OperatorsListResponse = Static<typeof OperatorsListResponseSchema>;
export type AddOperatorRequest = Static<typeof AddOperatorRequestSchema>;
export type UpdateOperatorLevelRequest = Static<typeof UpdateOperatorLevelRequestSchema>;
export type OperatorActionResponse = Static<typeof OperatorActionResponseSchema>;
