import { randomBytes } from "node:crypto";
import { KademliaTables } from ".";

interface Node {
	id: string;
	pingMs: number;
}

class TestKademliaTables extends KademliaTables<Node> {
	getTableIndex(node: Node): number {
		return node.pingMs < 30 ? 0 : node.pingMs < 100 ? 1 : 2;
	}
}

const tables = new TestKademliaTables(randomBytes(8).toString("hex"), { tableCount: 3, encoding: "hex" });

const randomId = () => randomBytes(8).toString("hex");
const randomPing = () => Math.round(Math.random() * 200);

it("returns true when node added", () => {
	const node = { id: randomId(), pingMs: randomPing() };

	const result = tables.add(node);

	expect(result).toBe(true);
	expect(tables.nodes.length).toBe(1);
});

it("returns false when node added but bucket full", () => {
	const customTable = new TestKademliaTables("00000000", { tableCount: 3, encoding: "hex", bucketSize: 10 });

	const node = { id: `ffffffff`, pingMs: 10 };

	for (let i = 0; i < 20; i++) {
		customTable.add({ id: `fffffff${i.toString(10)}`, pingMs: 10 });
	}

	const result = customTable.add(node);

	expect(result).toBe(false);
	expect(customTable.nodes.length).toBe(10);
});

it("returns true when table has node", () => {
	const node = { id: randomId(), pingMs: randomPing() };

	tables.add(node);

	const result = tables.has(node.id);

	expect(result).toBe(true);
});

it("returns false when table does not have node", () => {
	const result = tables.has(randomId());

	expect(result).toBe(false);
});

it("gets a node", () => {
	const node = { id: randomId(), pingMs: randomPing() };

	tables.add(node);

	const resultNode = tables.get(node.id);

	expect(resultNode).toStrictEqual(node);
});

it("gets correct tablesIndex for node", () => {
	const node = { id: randomId(), pingMs: 10 };

	const result = tables.getTableIndex(node);

	expect(result).toBe(0);
});

it("gets correct bucketIndex for id", () => {
	const customTables = new TestKademliaTables("0000", { encoding: "hex" });

	const node = { id: "00ff", pingMs: 10 };

	customTables.add(node);

	const bucketIndex = customTables.tables[0].getBucketIndex(node.id);

	expect(bucketIndex).toBe(7);
});

it("gets 100 closest nodes out of 1000", () => {
	const customTables = new TestKademliaTables(randomId(), { encoding: "hex" });

	const node = { id: randomId(), pingMs: randomPing() };

	customTables.add(node);

	for (let i = 0; i < 1000; i++) {
		customTables.add({ id: randomId(), pingMs: randomPing() });
	}

	const closestNodes = customTables.closest(node.id, 100);

	expect(closestNodes[0]).toStrictEqual(node);
	expect(closestNodes.length).toBe(100);
});

it("sends node to tail of bucket on seen", () => {
	const customTables = new TestKademliaTables("00000000", { encoding: "hex" });

	const node = { id: `ffffffff`, pingMs: randomPing() };

	customTables.add(node);

	for (let i = 0; i < 10; i++) {
		customTables.add({ id: `fffffff${i.toString(10)}`, pingMs: randomPing() });
	}

	const result = customTables.seen(node.id);

	expect(result).toBe(true);

	const tableIndex = customTables.getTableIndex(node);
	const bucketIndex = customTables.getBucketIndex(node.id);

	const bucket = customTables.tables[tableIndex].buckets[bucketIndex];

	const lastNode = bucket.at(-1);

	expect(lastNode).toStrictEqual(node);
});
