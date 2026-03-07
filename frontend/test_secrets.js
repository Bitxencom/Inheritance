import secrets from "secrets.js-grempe";

try {
    const combined = secrets.combine(["invalid1", "invalid2", "invalid3"]);
    console.log(combined);
} catch (e) {
    console.error("Error 1:", e.message);
}

try {
    const combined = secrets.combine(["8010abc", "8020def", "8030ghi"]);
    console.log(combined);
} catch (e) {
    console.error("Error 2:", e.message);
}

try {
    // Try combining 3 strings that look like shares but are invalid lengths
    const share = secrets.share(Array.from({ length: 64 }, () => '1').join(''), 5, 3)[0];
    const combined = secrets.combine([share, share.slice(0, -1), share.slice(0, -2)]);
    console.log(combined);
} catch (e) {
    console.error("Error 3:", e.message);
}
