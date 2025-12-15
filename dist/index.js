"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInTransaction = exports.GenericDAO = exports.Entity = void 0;
// --- Core Abstractions ---
var entity_model_js_1 = require("./entity.model.js");
Object.defineProperty(exports, "Entity", { enumerable: true, get: function () { return __importDefault(entity_model_js_1).default; } });
var GenericDAO_js_1 = require("./GenericDAO.js");
Object.defineProperty(exports, "GenericDAO", { enumerable: true, get: function () { return __importDefault(GenericDAO_js_1).default; } });
// --- Types and Utilities ---
__exportStar(require("./utils/types.js"), exports);
// --- Decorators and Errors ---
__exportStar(require("./utils/type-decorators.js"), exports);
// --- Transaction Manager ---
var TransactionManager_js_1 = require("./TransactionManager.js");
Object.defineProperty(exports, "runInTransaction", { enumerable: true, get: function () { return TransactionManager_js_1.runInTransaction; } });
