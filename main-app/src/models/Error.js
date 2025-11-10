class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Acción denegada por falta de permisos") {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
  }
}

class InactiveAccountError extends AppError {
  constructor(
    message = "Tu cuenta está inactiva, por favor contacta al administrador."
  ) {
    super(message, 403);
  }
}

class AccountLockedError extends AppError {
  constructor(message = "Cuenta bloqueada") {
    super(message, 403);
  }
}

class ConflictDBError extends AppError {
  constructor(message = "Se han presentado conflictos en la base de datos") {
    super(message, 409);
  }
}

class BadRequestError extends AppError {
  constructor(
    message = "El servidor no puede procesar su solicitud debido a un error en los datos o la forma de la solicitud"
  ) {
    super(message, 400);
  }
}

class ParkingSpaceUnavailableError extends AppError {
  constructor(message = "El espacio no está disponible") {
    super(message, 409);
  }
}

class BusinessConflictError extends AppError {
  constructor(message = "Alguna regla de negocio esta siendo infringida") {
    super(message, 400);
  }
}

export {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InactiveAccountError,
  AccountLockedError,
  ConflictDBError,
  BadRequestError,
  ParkingSpaceUnavailableError,
  BusinessConflictError,
};
