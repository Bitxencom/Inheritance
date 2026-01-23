const ethers = require("./node_modules/.pnpm/ethers@6.16.0/node_modules/ethers/lib.commonjs/ethers.js");
const sig = "registerData((bytes32,string,uint8,uint256,string,string,bool,uint256,string))";
// ethers v6 uses id() for text hashing (keccak256 of utf8)
try {
  console.log("Selector:", ethers.id(sig).slice(0, 10));
} catch (e) {
  // v5 fallback?
  try {
    console.log("Selector v5:", ethers.utils.id(sig).slice(0, 10));
  } catch (e2) {
    console.error(e);
  }
}
