"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHierarchy = buildHierarchy;
exports.extractRelationships = extractRelationships;
const colors_1 = require("@/lib/colors");
function buildHierarchy(response) {
    var _a;
    if (!response)
        return null;
    const root = {
        id: response.pi,
        name: response.pi,
        value: 0,
        color: "#1E293B",
        children: [],
        data: {
            path: [response.pi],
            depth: 0
        }
    };
    const nodeIndex = new Map();
    nodeIndex.set(response.pi, root);
    const sortedNodes = [...response.nodes].sort((a, b) => a.path.length - b.path.length);
    for (const node of sortedNodes) {
        let parent = root;
        for (let level = 1; level < node.path.length; level++) {
            const slice = node.path.slice(0, level + 1);
            const pathKey = slice.join("|");
            let current = nodeIndex.get(pathKey);
            if (!current) {
                const issueKey = slice[level];
                const meta = response.meta.issues[issueKey];
                const depth = slice.length - 1;
                current = {
                    id: pathKey,
                    name: (_a = meta === null || meta === void 0 ? void 0 : meta.key) !== null && _a !== void 0 ? _a : issueKey,
                    value: 0,
                    color: (0, colors_1.getStatusColor)(meta === null || meta === void 0 ? void 0 : meta.statusCategory, meta === null || meta === void 0 ? void 0 : meta.status),
                    children: [],
                    data: {
                        issueKey: meta === null || meta === void 0 ? void 0 : meta.key,
                        statusCategory: meta === null || meta === void 0 ? void 0 : meta.statusCategory,
                        status: meta === null || meta === void 0 ? void 0 : meta.status,
                        assignee: meta === null || meta === void 0 ? void 0 : meta.assignee,
                        label: meta ? `${meta.key} · ${meta.type}` : issueKey,
                        path: slice,
                        type: meta === null || meta === void 0 ? void 0 : meta.type,
                        depth
                    }
                };
                parent.children.push(current);
                nodeIndex.set(pathKey, current);
            }
            if (level === node.path.length - 1) {
                current.value += 1;
            }
            parent = current;
        }
    }
    propagateValues(root);
    equalizeFirstRing(root);
    updateRootValue(root);
    pruneEmptyNodes(root);
    return root;
}
function extractRelationships(response, issueKey) {
    if (!response) {
        return { parents: [], children: [] };
    }
    const parents = new Set();
    const children = new Set();
    for (const node of response.nodes) {
        const index = node.path.indexOf(issueKey);
        if (index === -1) {
            continue;
        }
        if (index > 1) {
            const parentKey = node.path[index - 1];
            if (parentKey !== response.pi) {
                parents.add(parentKey);
            }
        }
        if (index < node.path.length - 1) {
            const childKey = node.path[index + 1];
            if (childKey !== response.pi) {
                children.add(childKey);
            }
        }
    }
    const parentMetas = keysToMeta(response, Array.from(parents));
    const childMetas = keysToMeta(response, Array.from(children));
    return {
        parents: parentMetas,
        children: childMetas
    };
}
function keysToMeta(response, keys) {
    const map = response.meta.issues;
    const metas = [];
    const seen = new Set();
    for (const key of keys) {
        if (seen.has(key))
            continue;
        const meta = map[key];
        if (meta) {
            metas.push(meta);
            seen.add(key);
        }
    }
    return metas;
}
function propagateValues(node) {
    var _a;
    node.children = (_a = node.children) !== null && _a !== void 0 ? _a : [];
    if (node.children.length === 0) {
        return node.value;
    }
    let total = 0;
    for (const child of node.children) {
        total += propagateValues(child);
    }
    node.value = total;
    return total;
}
function pruneEmptyNodes(node) {
    node.children = node.children.filter((child) => child.value > 0);
    for (const child of node.children) {
        pruneEmptyNodes(child);
    }
}
function equalizeFirstRing(root) {
    if (!root.children || root.children.length === 0 || root.value === 0) {
        return;
    }
    for (const child of root.children) {
        if (child.value <= 0) {
            child.value = 1;
            continue;
        }
        const factor = 1 / child.value;
        scaleSubtree(child, factor);
        child.value = 1;
    }
}
function scaleSubtree(node, factor) {
    var _a;
    node.value *= factor;
    for (const child of (_a = node.children) !== null && _a !== void 0 ? _a : []) {
        scaleSubtree(child, factor);
    }
}
function updateRootValue(root) {
    if (!root.children || root.children.length === 0) {
        return;
    }
    root.value = root.children.reduce((sum, child) => sum + child.value, 0);
}
