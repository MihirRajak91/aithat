"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setExtensionContext = setExtensionContext;
exports.getExtensionContext = getExtensionContext;
let extensionContext = null;
function setExtensionContext(context) {
    extensionContext = context;
}
function getExtensionContext() {
    return extensionContext;
}
//# sourceMappingURL=context.js.map