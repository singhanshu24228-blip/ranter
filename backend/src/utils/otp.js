import crypto from "node:crypto";
import { redisClient } from "../config/redis.js";

const otpTtlSeconds = 10 * 60;
const otpHmacSecret = process.env.SESSION_SECRET || crypto.randomBytes(32);
const consumeScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

function hashOtp(otp) {
  return crypto.createHmac("sha256", otpHmacSecret).update(String(otp)).digest("hex");
}

export function createOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function storeOtp(key, otp) {
  await redisClient.set(key, hashOtp(otp), { EX: otpTtlSeconds });
}

export async function consumeOtp(key, otp) {
  const result = await redisClient.eval(consumeScript, {
    keys: [key],
    arguments: [hashOtp(otp)],
  });
  return Number(result) === 1;
}

export async function clearOtp(key) {
  await redisClient.del(key);
}