import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../models/Error.js";

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });
}

function verifyJwtToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new UnauthorizedError("Token inválido o expirado");
  }
}

export { generateToken, verifyJwtToken };
