/**
 * Copyright (c) 2020 Colin Leung (Komino)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */


/**
 * private method getByte;
 *
 * @param {DataView} data
 * @param {number} idx
 * @param {number} size
 * @return *
 */
const getByte = (data, idx, size) => {
  const offsetBit = idx * size;
  const offsetByte = Math.floor(offsetBit / 8);
  const shiftBit   = offsetBit % 8;

  const max = (2 ** size) - 1;

  const frameSize   = (size <= 8) ? 8 : ((size <= 16) ? 16 : 32);
  let frame;
  switch (frameSize) {
    case (8):
      frame = data.getUint8(offsetByte);
      break;
    case (16):
      frame = data.getUint16(offsetByte);
      break;
    default :
      frame = data.getUint32(offsetByte);
  }

  const valueOffset = (frameSize - size - shiftBit);

  return {offsetByte : offsetByte, data: data, mask: max, frame: frame, frameSize : frameSize, valueOffset: valueOffset};
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
   * @param {number} version
   * @param {number} headerByteSize
   * @param {number} dataBitSize
   * @param {number[]}values
   */
  constructor(version= 1, headerByteSize= 1, dataBitSize= 8, values = []) {
    if(version < 0 || headerByteSize < 0 || dataBitSize < 0 )throw new Error('BinaryStore: arguments cannot be negative');

    this.version    = version;
    this.headerByteSize = headerByteSize;
    this.dataBitSize   = dataBitSize;
    this.maxValue   = (2 ** dataBitSize) - 1;

    //data bytes + 1 byte header
    const bufferSize = this.headerByteSize + Math.ceil((Math.max(2, values.length) * this.dataBitSize) / 8 );
    this.setBuffer(new ArrayBuffer(bufferSize));

    values.forEach((x, i) => this.write(i, x));

    this.makeHeader(this.header, this.headerByteSize, this.version, this.dataBitSize);
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
        header.setUint8(0, version << 5 | dataBitSize);
        break;
      case (2):
        header.setUint16(0, version << 5 | dataBitSize);
        break;
      case (3):
        header.setUint16(0, version);
        header.setUint8(2, dataBitSize);
        break;
      case (4):
        header.setUint32(0, version << 5 | dataBitSize);
        break;
      default :
        header.setUint32(0, version);
        header.setUint8(4, dataBitSize);
    }
  }

  /**
   * @param {number} idx
   * @return number
   */
  read(idx){
    const {mask, frame, valueOffset} = getByte(this.data, idx, this.dataBitSize);
    return (frame >> valueOffset) & mask;
  }

  expandBuffer(){
    const destView = new Uint8Array(new ArrayBuffer((this.buffer.byteLength - this.headerByteSize) * 2 + this.headerByteSize));
    destView.set(new Uint8Array(this.buffer));
    this.setBuffer(destView.buffer);
  }

  /**
   * @param {number} idx
   * @param {number} value
   */
  write(idx, value){
    if(value > this.maxValue)throw new Error('value is bigger than ' + this.maxValue);
    if(idx >= (this.buffer.byteLength - this.headerByteSize)){
      this.expandBuffer();
    }

    const {data, offsetByte, mask, frameSize, frame, valueOffset} = getByte(this.data, idx, this.dataBitSize);

    const newFrame = frame & ~(mask << valueOffset) | (value << valueOffset);

    switch (frameSize) {
      case (8):
        data.setUint8(offsetByte, newFrame);
        break;
      case (16):
        data.setUint16(offsetByte, newFrame);
        break;
      default :
        data.setUint32(offsetByte, newFrame);
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