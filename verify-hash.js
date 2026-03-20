const argon2 = require('argon2');

async function verify() {
  const password = 'maryam@928';
  try {
    const hash = await argon2.hash(password);
    console.log("New Hash:", hash);
    const isMatch = await argon2.verify(hash, password);
    console.log("Is Match:", isMatch);
    
    // Testing case sensitivity
    const isMatchUpper = await argon2.verify(hash, 'Maryam@928');
    console.log("Is Match (Upper):", isMatchUpper);
  } catch (err) {
    console.error(err);
  }
}

verify();
