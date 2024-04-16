# kademlia-tables

An extension of the [kademlia-table](https://www.npmjs.com/package/kademlia-table) library for managing nodes between many kademlia tables.

```
npm install kademlia-tables
```

[kademlia-table](https://www.npmjs.com/package/kademlia-table) package is an extendable implementation of Kademlia and K-Buckets closely following details set out in the [Kademlia DHT paper](https://pdos.csail.mit.edu/~petar/papers/maymounkov-kademlia-lncs.pdf).

The default implementation of Kademlia has drawbacks such as long node traversal time since round trip time and locality are not taken into account. When traversing nodes, the local node may contact nodes on the other side of the world just to find it needs to contact a node in the next building. 

The [Sloppy hashing and self-organizing clusters paper](http://iptps03.cs.berkeley.edu/final-papers/coral.pdf) suggests clustering as a remedy to this. Multiple tiers of Kademlia Table with nodes sorted by round trip time gives rise to node clustering around locality and connectivity. Nodes with lower table index and thus lower round trip response times are preffered when building routes, drastically reducing traversal time.

The `KademliaTables` class is extendable to prefer metrics other than round trip time to build clustering around that metric.

## Usage

```js
import { KademliaTables } from "kademlia-tables";
import { randomBytes } from "node:crypto";

interface Node {
	id: string;
	pingMs: number;
	// ...properties of Node
}

// The base KademliaTables class is abstract and must be extended with a custom method to assign nodes to a table.
class CustomTables extends KademliaTables<Node> {
	// Required table assignment method
	getTableIndex(node: Node): number {
		return node.pingMs < 30 ? 0 : node.pingMs < 100 ? 1 : 2; // Assign a node to table 0, 1, or 2 depending on pingMs

		// Tables are indexed by number with 0 being the most preferred table.
	}

	// Optional customization of the add method
	add(node: Node): boolean {
		const result = super.add(node);

		if (!result) {
			// Do something if bucket is full and retry
			return this.add(node);
		}

		return true;
	}
}

// Create new tables that store nodes "close" to the passed in id.
// The id should be uniformily distributed, ie a hash, random bytes etc.
const tables = new KademliaTables<Node>(id(), { tableCount: 3 });

// Add a node to the routing tables
tables.add({ id: id() });

// Get the 20 nodes "closest" to a passed in id
const closest = table.closest(id(), 20);
```

## API

#### `table = new KademliaTable(id, [configuration])`

Create a new routing table.

`id` should be a string that is uniformily distributed. `configuration` includes:

```js
{
  bucketSize?: 20 // Max number of nodes in a bucket
  encoding?: "utf8" // Encoding of id strings
  tableCount?: 3 // Number of tables, indexed 0 - length-1
  preferenceFactor?: 2 // Range of closeness is multiplied by this every step closer to the most preferred table

  // Eg. Table 2 returns 3 nodes in a 2 bucket range. Table 1 can return nodes in 4 bucket range and Table 0 can return nodes in a 8 bucket range.
  // The reason for this is that it is preferrable to route through a node that is further away in the binary tree but has a 10ms round trip time than a closer node with a 200ms round trip time.

  KademliaTable?: KademliaTable // Allows for using your own extended KademliaTables.
}
```

#### `bool = tables.add(node)`

Insert a new node. `node.id` must be a string of same or shorter length as `tables.id`.
When inserting a node the XOR distance between the node and the `tables.id` is
calculated and used to figure which bucket this node should be inserted into.

Returns `true` if the node could be added or already exists.
Returns `false` if the bucket is full.

#### `bool = tables.has(id)`

Returns `true` if a node exists for the passed in `id` and `false` otherwise.

#### `node = tables.get(id)`

Returns a node or `undefined` if not found.

#### `ti = tables.getTableIndex(node)`

Returns a node's corresponding table index.

#### `i = tables.getBucketIndex(id)`

Returns a node's corresponding bucket index.

#### `nodes = tables.closest(id, [maxNodes])`

Returns an array of the closest (in XOR distance) nodes to the passed in id.

This method is normally used in a routing context, i.e. figuring out which nodes
in a DHT should store a value based on its id.

Nodes are preferred from lower index tables even though they may not be as close. `preferenceFactor` in the tables configuration sets the size of this effect.

Returns an exact match first regardless of table index.

#### `true = tables.remove(id)`

Remove a node using its id.

#### `tables.nodes`

Returns all nodes from tables as an array. Ordered from closest to furthest buckets.

#### `tables.buckets`

A fixed size array of all buckets in the tables.

#### `tables.tables`

A fixed size array of all tables.

#### `number = KademliaTables.getDistance(idA, idB, encoding)`

Gets the XOR distance between two id strings.

#### `1 | -1 | 0 = compare(idA, idB) = KademliaTables.createCompare(targetId, encoding)`

Creates a function for sorting ids based on distance from a target id going from closest to furthest

## License

MIT
