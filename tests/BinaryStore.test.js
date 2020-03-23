const BinaryStore = require('../classes/BinaryStore');

describe('test binary store', () => {
  test('1 byte header', () => {
    const f = new BinaryStore(1, 1, 16);
    expect(f.toString()).toBe('00110000 : 0000000000000000 0000000000000000 ');
    expect(f.version).toBe(1);
    expect(f.headerByteSize).toBe(1);
    expect(f.maxValue).toBe(65535);
  });

  test('2 byte header', () => {
    //header padding zero to higher bits if header length is not multiple of 8.
    const version = 255;
    const dataSize = 8;
    const f = new BinaryStore(version, 2, dataSize, [255, 200]);
    expect(version.toString(2)).toBe('11111111');
    expect((version << 5).toString(2)).toBe('1111111100000');
    expect((version << 5 | 8).toString(2)).toBe('1111111101000');

    expect((255).toString(2)).toBe('11111111');
    expect((200).toString(2)).toBe('11001000');

    expect(f.toString()).toBe('11111111 00001000 : 11111111 11001000 ');
  });

  test('3 byte header', () => {
    //header padding zero to higher bits if header length is not multiple of 8.
    const f = new BinaryStore(255, 3, 8, [255, 200]);

    expect(f.toString()).toBe('00000000 11111111 00001000 : 11111111 11001000 ');
  });

  test('4 byte header', () => {
    //header padding zero to higher bits if header length is not multiple of 8.
    const version = 255;
    const dataSize = 8;
    const f = new BinaryStore(version, 4, dataSize, [255, 200]);
    expect(version.toString(2)).toBe('11111111');
    expect((version << 5).toString(2)).toBe('1111111100000');
    expect((version << 5 | 8).toString(2)).toBe('1111111101000');

    expect((255).toString(2)).toBe('11111111');
    expect((200).toString(2)).toBe('11001000');

    expect(f.toString()).toBe('00000000 00000000 11111111 00001000 : 11111111 11001000 ');
  });

  test('init with values', () => {
    const f = new BinaryStore(1563669060, 5, 16, [12000, 2413]);

    /* 01011101 00110011 10110010 01000100 */

    expect(f.toString()).toBe('01011101 00110011 10110010 01000100 00010000 : 0010111011100000 0000100101101101 ');

    expect(f.read(0)).toBe(12000n);
    expect(f.read(1)).toBe(2413n);
  });

  test('init with qty, 10 bit size', () => {
    const f = new BinaryStore(1563669060, 5, 10, [520, 1023]);

    expect(f.toString()).toBe('01011101 00110011 10110010 01000100 00001010 : 1000001000 1111111111 0000');

    expect(f.read(0)).toBe(520n);
    expect(f.read(1)).toBe(1023n);

    f.write(3, 888);
    expect(f.read(3)).toBe(888n);
    expect(f.toString()).toBe('01011101 00110011 10110010 01000100 00001010 : 1000001000 1111111111 0000000000 1101111000 00000000');

    f.write(2, 56);
    expect(f.read(3)).toBe(888n);
    expect(f.read(2)).toBe(56n);
    expect(f.toString()).toBe('01011101 00110011 10110010 01000100 00001010 : 1000001000 1111111111 0000111000 1101111000 00000000');

    try{
      f.read(4);
      expect('').toBe('Error should be throw, this test should not be run.');
    }catch(e){
      expect(e.message).toBe('Offset is outside the bounds of the DataView');
    }
  });

  test('assign overflow number', ()=>{
    const f = new BinaryStore(1563669060, 5, 10, [520, 1023]);
    try{
      f.write(1, 1024);
      expect('').toBe('Error should be throw, this test should not be run.');
    }catch(e){
      expect(e.message).toBe('value is bigger than 1023');
    }
  })

  test('expand file', () => {
    const f = new BinaryStore(1563669060, 5, 8, [120, 200, 80, 55]);
    expect(f.toString()).toBe('01011101 00110011 10110010 01000100 00001000 : 01111000 11001000 01010000 00110111 ');
    f.write(4, 33);
    expect(f.toString()).toBe('01011101 00110011 10110010 01000100 00001000 : 01111000 11001000 01010000 00110111 00100001 00000000 00000000 00000000 ');
  });

  test('32bit integer', () => {
    const f = new BinaryStore(1563669060, 5, 32, [2147483642]);
    expect(f.toString()).toBe('01011101 00110011 10110010 01000100 00100000 : 01111111111111111111111111111010 00000000000000000000000000000000 ');
    expect(f.read(0)).toBe(2147483642n);

  });

  // is reading https://www.cs.odu.edu/~cs252/Book/branchcov.html
  test('cover constructor', ()=>{
    try{
      const f = new BinaryStore(-1, -1, -16, [-100]);
      expect('').toBe('Error should be throw, this test should not be run.');
    }catch(e){
      expect(e.message).toBe('BinaryStore: arguments cannot be negative');
    }
  });

  test('cover constructor with default values', ()=>{
    const f = new BinaryStore();
    expect(f.toString()).toBe('00101000 : 00000000 00000000 ');
  })

  test('big integer', () =>{
    const ver = BigInt('0b101011111111000000001111111100000000');//47227928320n;//BigInt(0b1010_1111_1111_0000_0000_1111_1111_0000_0000);
    const f = new BinaryStore(ver, 6, 8, [255, 200]);
    expect(f.toString()).toBe( '00001010 11111111 00000000 11111111 00000000 00001000 : 11111111 11001000 ');
  })

});