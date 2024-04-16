import { KademliaTable } from "kademlia-table";
import type { Encoding } from "node:crypto";

export namespace KademliaTables {
	export interface Configuration extends KademliaTable.Configuration {
		KademliaTable?: typeof KademliaTable;
		preferenceFactor?: number;
		tableCount?: number;
	}
}

export abstract class KademliaTables<N extends KademliaTable.Node = KademliaTable.Node> {
	static getDistance = KademliaTable.getDistance;
	static createCompare = KademliaTable.createCompare;

	readonly bucketSize: number;
	readonly bucketCount: number;

	readonly KademliaTable: typeof KademliaTable;
	readonly preferenceFactor: number;
	readonly tableCount: number;
	readonly tables: Array<KademliaTable<N>>;

	readonly encoding: Encoding;

	constructor(readonly id: string, configuration: KademliaTables.Configuration = {}) {
		this.encoding = configuration.encoding || "utf8";

		this.bucketSize = configuration.bucketSize || 20;
		this.bucketCount = Buffer.from(id, this.encoding).length * 8 + 1;

		this.KademliaTable = configuration.KademliaTable || KademliaTable;
		this.preferenceFactor = configuration.preferenceFactor || 2;
		this.tableCount = configuration.tableCount || 3;
		this.tables = Array.apply(null, Array(this.tableCount)).map(() => new this.KademliaTable<N>(id, configuration));
	}

	get buckets() {
		return this.tables.map((table) => table.buckets).flat();
	}

	get nodes() {
		return this.tables.map((table) => table.nodes).flat();
	}

	abstract getTableIndex(node: N): number;

	add(node: N, ti: number = this.getTableIndex(node)) {
		const table = this.tables[ti];

		return table.add(node);
	}

	has(id: string, i: number = this.getBucketIndex(id)) {
		return this.tables.some((table) => table.has(id, i));
	}

	get(id: string, i: number = this.getBucketIndex(id)) {
		const results = this.tables.map((table) => table.get(id, i));

		return results.find((result) => !!result);
	}

	getBucketIndex(id: string) {
		return this.tables[0].getBucketIndex(id);
	}

	closest(id: string, limit: number = 3) {
		const node = this.get(id);

		const hasNode = !!node;

		const nodes = this.getNodes(id, this.tableCount - 1, limit);

		const preferredNodes = nodes.reverse().slice(0, limit);

		return hasNode ? [node, ...preferredNodes.filter((preferredNode) => preferredNode.id !== id).slice(0, limit - 1)] : preferredNodes;
	}

	update(id: string, body: Partial<Omit<N, "id">>) {
		const i = this.getBucketIndex(id);

		const node = this.get(id, i);

		if (!node) return false;

		const updatedNode = {
			...node,
			...body,
		};

		const ti = this.getTableIndex(updatedNode);

		if (ti !== this.getTableIndex(node)) {
			this.remove(id);
			this.add(updatedNode, ti);

			return updatedNode;
		}

		const index = this.tables[ti].buckets[i].findIndex((node) => node.id === id);

		this.tables[ti].buckets[i][index] = updatedNode;

		return updatedNode;
	}

	seen(id: string) {
		const i = this.getBucketIndex(id);

		const node = this.get(id, i);

		if (!node) return false;

		const ti = this.getTableIndex(node);

		this.tables[ti].buckets[i] = this.tables[ti].buckets[i].filter((node) => node.id !== id).concat([node]);

		return true;
	}

	remove(id: string) {
		const i = this.getBucketIndex(id);

		this.tables.forEach((table) => table.remove(id, i));

		return true;
	}

	protected getNodes(id: string, ti0: number, limit: number, offsetBoundary?: number, depth: number = 0): Array<N> {
		const ti = ti0 - depth;

		const table = this.tables[ti];

		const i0 = this.getBucketIndex(id);

		const nodes = table.closest(id, limit).filter((node) => Math.abs(i0 - this.getBucketIndex(node.id)) <= (offsetBoundary || this.bucketCount));

		const nodeOffsets = nodes.map((node) => Math.abs(i0 - this.getBucketIndex(node.id)));

		const maxOffset = Math.max(...nodeOffsets);

		if (ti > 0) return nodes.concat(this.getNodes(id, ti0, limit, Math.max(Math.max(maxOffset, 1) * this.preferenceFactor, (offsetBoundary || 1) * 2), depth + 1));

		return nodes;
	}
}
