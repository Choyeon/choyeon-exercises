/** 极简断言集 —— 测试文件共用，避免引入任何测试框架依赖。 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function eq(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${msg || 'not equal'}: 期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`
    );
  }
}

function deepEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || 'deep not equal'}: 期望 ${b}，实得 ${a}`);
}

/** 浮点比较 —— 1RM / 容量这类计算直接 === 会被浮点尾数打挂 */
function close(actual, expected, tol = 0.05, msg) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tol) {
    throw new Error(
      `${msg || 'not close'}: 期望 ${expected}±${tol}，实得 ${JSON.stringify(actual)}`
    );
  }
}

module.exports = { assert, eq, deepEq, close };
