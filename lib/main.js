"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
function readJsonExample(filename) {
    const rawJson = fs_1.default.readFileSync(filename);
    const jsonExample = JSON.parse(rawJson.toString());
    return jsonExample;
}
