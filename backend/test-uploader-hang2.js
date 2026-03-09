import Arweave from 'arweave';
const arweave = Arweave.init({});
async function fakeFail() {
   const tx = await arweave.createTransaction({ data: "hello world block".repeat(100) });
   await arweave.transactions.sign(await arweave.wallets.generate(), tx);
   const uploader = await arweave.transactions.getUploader(tx);
   // Force uploadChunk to hit a real arweave gateway with a fake signature/corrupted tx
   tx.signature = tx.signature.replace(/a/g, 'b'); // invalidate sig
   try {
       await uploader.uploadChunk();
       console.log("lastResponseStatus:", uploader.lastResponseStatus);
   } catch(e) {
       console.log("threw:", e);
   }
}
fakeFail();
