/**
 * Copyright (c) 2020 Colin Leung (Komino)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

const ceilDivide = (x, y) => (x + y - 1n) / y;
/**
 * private method getByte;
 *
 * @param {DataView} data
 * @param {BigInt} idx
 * @param {BigInt} size
 * @return *
 *
 */
const getFrame = (data, idx, size) => {
  const startBit = idx * size;
  const endBit   = startBit + size;

  const startByte =  startBit / 8n; //Math.floor(startBit);
  const endByte   = ceilDivide( endBit, 8n);

  let result = BigInt(0);
  for(let i = startByte; i < endByte; i++ ){
    const segment = BigInt(data.getUint8(parseInt(i)));
    result = result << 8n | segment;
  }

  return {
    frame : result,
    startBit: startBit,
    endBit: endBit,
    startByte: startByte,
    endByte: endByte
  };
};

/**
 * @param {Uint8Array} uint8Array
 * @param {number} size
 */
const toBinaryString = (uint8Array, size = 8) => {
  return uint8Array
    .reduce((a , x) => "" + a + x.toString(2).padStart( 8 , "0" ), "")
    .replace(new RegExp(`(.{${size}})`, "g"),"$1 ") ;
};

/*
explain of the array buffer

version 1, data size 16
00 1       1 00 00

00 11 00 00 : 00 00 00 00 00 00 00 00 11 11 11 11 11 11 11 11
<bytes[0]->   <bytes[0]-> <bytes[1]-> <bytes[2]-> <bytes[3]->
<-header ->   <-    16bit frame    -> <-    16bit frame    ->

version 1, data size 10
00 1       0 10 10

00 10 10 10 : 00 00 00 00 00 11 11 11 11 11 00 00 00 00 00 00
<bytes[0]->   <bytes[0]-> <bytes[1]-> <bytes[2]-> <bytes[3]->
<-header ->   <10bit frame-> <10bit frame-> <10bit frame->
*/

class BinaryStore{
  /**
   *
   * @param {number | BigInt} version
   * @param {number} headerByteSize
   * @param {number} dataBitSize
   * @param {number[]}values
   */
  constructor(version= 1, headerByteSize= 1, dataBitSize= 8, values = []) {
    if(version < 0 || headerByteSize < 0 || dataBitSize < 0 )throw new Error('BinaryStore: arguments cannot be negative');

    this.version = version;
    this.headerByteSize = headerByteSize;
    this.dataBitSize = dataBitSize;
    this.maxValue = (2 ** dataBitSize) - 1;

    //data bytes + 1 byte header
    const bufferSize = this.headerByteSize + Math.ceil((Math.max(2, values.length) * this.dataBitSize) / 8 );
    this.setBuffer(new ArrayBuffer(bufferSize));

    this.makeHeader(this.header, this.headerByteSize, this.version, this.dataBitSize);

    values.forEach((x, i) => this.write(i, x));
  }

  /*
   *
   * @param {ArrayBuffer} buffer
   */
  setBuffer(buffer){
    this.buffer = buffer;
    this.header = new DataView(buffer, 0, this.headerByteSize);
    this.data   = new DataView(buffer, this.headerByteSize);
  }

  /**
   * @param {DataView} header
   * @param {number} headerByteSize
   * @param {number} version
   * @param {number} dataBitSize
   */
  makeHeader(header, headerByteSize, version, dataBitSize){
    //create default header;
    switch (headerByteSize) {
      case (1):
        //8bit
        //poor man, max dataBitSize = 5
        header.setUint8(0, version << 5 | dataBitSize);
        break;
      case (2):
        //16bit
        //max version = (2 ** 8 - 1) 255
        //max dataBitSize = 255
        header.setUint8(0, version);
        header.setUint8(1, dataBitSize);
        break;
      case (3):
        //24bit
        //max version = (2 ** 16 - 1) 65535
        //max dataBitSize = 255
        header.setUint16(0, version);
        header.setUint8(2, dataBitSize);
        break;
      case (4):
        //32bit
        //max version = (2 ** 24 - 1 ) 16777215
        //max dataBitSize = 255
        header.setUint32(0, version << 8 | dataBitSize);
        break;
      case (5):
        //40bit
        //max version = 2 ** 32 - 1
        //max dataBitSize = 255
        header.setUint32(0, version);
        header.setUint8(4, dataBitSize);
        break;
      default :
        let bits = BigInt(version);
        for(let offset = (headerByteSize - 2); offset >= 0 ; offset--){
          header.setUint8(offset, parseInt(bits & 255n));
          bits = bits >> 8n;
        }

        header.setUint8((headerByteSize - 1), dataBitSize);
    }
  }

  expandBuffer(){
    const destView = new Uint8Array(new ArrayBuffer((this.buffer.byteLength - this.headerByteSize) * 2 + this.headerByteSize));
    destView.set(new Uint8Array(this.buffer));
    this.setBuffer(destView.buffer);
  }

  /**
   * @param {number} index
   * @return BigInt
   */
  read(index){
    const idx = BigInt(index);
    const size = BigInt(this.dataBitSize);
    const {frame, endByte} = getFrame(this.data, idx , size);

    const shift = (endByte * 8n) - ((idx + 1n) * size);
    const mask = (2n ** size - 1n);

    return (frame >> shift) & mask;
  }

  /**
   * @param {number} index
   * @param {number | BigInt} newValue
   */
  write(index, newValue){
    if(newValue > this.maxValue)throw new Error('value is bigger than ' + this.maxValue);
    if(index >= (this.buffer.byteLength - this.headerByteSize)){
      this.expandBuffer();
    }

    const value = BigInt(newValue);
    const idx = BigInt(index);
    const size = BigInt(this.dataBitSize);
    const {frame, startByte, endByte} = getFrame(this.data, idx , size);

    const maskShift = (endByte * 8n) - ((idx + 1n) * size);
    const resultBitSize = (endByte - startByte) * 8n;
    const mask = (2n ** resultBitSize - 1n) ^ (((2n ** size - 1n)) << maskShift);

    let bits = (frame & mask) | (value << maskShift);
    for(let i = endByte - 1n ; i >= startByte; i-- ){
      this.data.setUint8(parseInt(i), parseInt(bits & 255n));
      bits = bits >> 8n;
    }
  }

  toString(){
    const head = toBinaryString(new Uint8Array(this.buffer.slice(0, this.headerByteSize)));
    const tail = toBinaryString(new Uint8Array(this.buffer, this.headerByteSize), this.dataBitSize);
    return head + ": " + tail;
  }

}

Object.freeze(BinaryStore);
Object.freeze(BinaryStore.prototype);
module.exports = BinaryStore;