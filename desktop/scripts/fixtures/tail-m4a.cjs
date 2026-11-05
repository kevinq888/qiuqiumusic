// Self-generated 30-second silent AAC/M4A (afconvert from 8kHz mono PCM).
// Move moov to the end and add a 4 MiB free atom to force decoder Range reads.
// This reproduces pool exhaustion that the small WAV fixtures cannot exercise.
const { inflateSync } = require('node:zlib');
module.exports = function tailM4a() {
  const original = inflateSync(Buffer.from('eJztlj9rFEEYxt/73wS8mTkhxUGOYGFjOJNDIohc7CwCAS0t3NzsmiU7t8vO3IFWW4gINn4EP4KFZQoRC8t8AklnFRBLC/GZ3T2zuaCgXXAe7tn33Zn5zbuzx80cEfUD8zTZHe0MCLJRJaPNUMeKqPNZxfEczZGaH0jb/6X55JU10dqYGu+IavnnTOduLt6P6Y+qE7UTk3qHyB+Zw7xm56xmOZutu1zir+q2V5QMPSQDJX+zrkLrBzJKFzc6nk2XH7j1QYXTAElXq2KmUtdk0d6XqR9UnmlllkaDIm+90GY/Qj7XRsvKmADfgHdhHXXq2rBWLGXL11LnLyPLsnXEJmJv3KNV23hCdDdroaV+9WUboYYXS1f0vsnL3L95C9dVbYyuVDnFHDa/jqeZ/KpZ9DXLeKeMcOMTxj2rrPi0HOfs7HxpXCNtJjEVwu/bbjJdXLoDeAiP4T34MZzAGfwafgO/hd/Dx/AJ/JWIgWfgGXgGnoFn4Bl4Bp6BZ+AZeAaegWfgGXgGnoPn4Dl4Dp6D5+A5eA6eg+fgOXgOnoPn4Dl4Dl6AF+AFeAFegBfgBXgBXoAX4AV4AZ6+z6Sxu+035ZvFrntu38dZkXpJElFVH8NIG8SjGxBiX/lefjpMYrVhR/sb4cPZ1Lc7bG/qKd/22ZYHu3v3kD6XXl4t398Hw1JFsj0qk81FUmhr5/b2cGnsPyc4WH8Eqe+Tk5OTk5OT03+jxpHCXxA6po6zs/Pl8U8+F22F', 'base64'));
  const boxes = [];
  for (let offset = 0; offset < original.length;) {
    const size = original.readUInt32BE(offset);
    boxes.push(original.subarray(offset, offset + size));
    offset += size;
  }
  const moov = Buffer.from(boxes.find(box => box.toString('ascii', 4, 8) === 'moov'));
  const stco = moov.indexOf('stco');
  const count = moov.readUInt32BE(stco + 8);
  for (let i = 0; i < count; i++) {
    const offset = stco + 12 + i * 4;
    moov.writeUInt32BE(moov.readUInt32BE(offset) - moov.length, offset);
  }
  const padding = Buffer.alloc(4 * 1024 * 1024);
  padding.writeUInt32BE(padding.length); padding.write('free', 4);
  return Buffer.concat([...boxes.filter(box => box.toString('ascii', 4, 8) !== 'moov'), padding, moov]);
};
