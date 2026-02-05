/**
 * Mock implementation of better-sqlite3 for testing
 */

class StatementMock {
  constructor(sql) {
    this.sql = sql;
  }

  run(...params) {
    return {
      changes: 1,
      lastInsertRowid: 1
    };
  }

  get(...params) {
    return null;
  }

  all(...params) {
    return [];
  }

  iterate(...params) {
    return [];
  }

  pluck(toggle) {
    return this;
  }

  expand(toggle) {
    return this;
  }

  raw(toggle) {
    return this;
  }

  bind(...params) {
    return this;
  }

  columns() {
    return [];
  }
}

class TransactionMock {
  constructor(fn) {
    this.fn = fn;
  }

  run(...params) {
    return this.fn(...params);
  }

  default(...params) {
    return this.fn(...params);
  }

  deferred(...params) {
    return this.fn(...params);
  }

  immediate(...params) {
    return this.fn(...params);
  }

  exclusive(...params) {
    return this.fn(...params);
  }
}

class DatabaseMock {
  constructor(path, options) {
    this.path = path;
    this.options = options || {};
    this.open = true;
    this.inTransaction = false;
  }

  prepare(sql) {
    return new StatementMock(sql);
  }

  exec(sql) {
    // Mock execution
  }

  transaction(fn) {
    return new TransactionMock(fn);
  }

  pragma(pragma, options) {
    return {};
  }

  checkpoint(databaseName) {
    return { logSize: 0, checkpointed: 0 };
  }

  close() {
    this.open = false;
  }

  defaultSafeIntegers(toggle) {
    return this;
  }

  backup(destination, options) {
    return Promise.resolve({
      totalPages: 0,
      remainingPages: 0
    });
  }

  serialize(options) {
    return Buffer.from('mock-database-serialized');
  }

  function(name, options, fn) {
    // Mock function registration
  }

  aggregate(name, options) {
    // Mock aggregate registration
  }

  loadExtension(path, entryPoint) {
    // Mock extension loading
  }
}

module.exports = DatabaseMock;
module.exports.Database = DatabaseMock;
module.exports.Statement = StatementMock;
module.exports.Transaction = TransactionMock;
