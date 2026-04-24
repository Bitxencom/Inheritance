document.addEventListener('DOMContentLoaded', () => {
    // --- State & Config ---
    const VALID_ID = "e8461a34-589d-480b-8f4b-c5409cd03383";

    // Mock answers for simplicity given the prompt requirements
    // In a real app, these would probably be hashes or validated against a backend/stored vault
    const ANSWERS = {
        1: "Smith",
        2: "Fluffy",
        3: "New York"
    };

    // --- DOM Elements ---
    const pages = {
        1: document.getElementById('page-1'),
        2: document.getElementById('page-2'),
        3: document.getElementById('page-3'),
        4: document.getElementById('page-4'),
        5: document.getElementById('page-5')
    };

    // Page 1 Elements
    const inputId = document.getElementById('deheritance-id');
    const btnUnlockStart = document.getElementById('btn-unlock-start');
    const errorMsg1 = document.getElementById('error-msg-1');

    // Page 2 Elements
    const q1Container = document.getElementById('q1-container');
    const q2Container = document.getElementById('q2-container');
    const q3Container = document.getElementById('q3-container');
    const inputAns1 = document.getElementById('ans-1');
    const inputAns2 = document.getElementById('ans-2');
    const inputAns3 = document.getElementById('ans-3');
    const btnQ1 = document.getElementById('btn-q1');
    const btnQ2 = document.getElementById('btn-q2');
    const btnQ3 = document.getElementById('btn-q3');
    const errorMsg2 = document.getElementById('error-msg-2');
    const progressBar = document.querySelector('.progress');

    // Page 3 Elements
    const key1 = document.getElementById('key-1');
    const key2 = document.getElementById('key-2');
    const key3 = document.getElementById('key-3');
    const key2Container = document.getElementById('key-2-container');
    const key3Container = document.getElementById('key-3-container');
    const btnDecrypt = document.getElementById('btn-decrypt');
    const errorMsg3 = document.getElementById('error-msg-3');

    // Page 4 Elements
    const confirmStep = document.getElementById('confirm-step');
    const loaderStep = document.getElementById('loader-step');
    const btnFinalUnlock = document.getElementById('btn-final-unlock');
    const loadingText = document.getElementById('loading-text');

    // Page 5 Elements
    const btnExit = document.getElementById('btn-exit');
    const modalExit = document.getElementById('exit-modal');
    const btnStay = document.getElementById('btn-stay');
    const btnConfirmExit = document.getElementById('btn-confirm-exit');


    // --- Helper Functions ---
    const messages = [
        "Vault is being downloaded...",
        "Vault is being decrypted...",
        "Vault is unlocked...",
        "Data is being imported...",
        "Data is being decrypted...",
        "Data is successfully decrypted!"
    ];

    function showPage(pageNum) {
        Object.values(pages).forEach(el => el.classList.add('hidden'));
        pages[pageNum].classList.remove('hidden');
        pages[pageNum].classList.add('fade-in');
    }

    function showError(element, show) {
        if (show) element.classList.remove('hidden');
        else element.classList.add('hidden');
    }

    // --- Event Listeners ---

    // === Page 1 Logic ===
    btnUnlockStart.addEventListener('click', () => {
        const val = inputId.value.trim();
        if (val === VALID_ID) {
            showError(errorMsg1, false);
            showPage(2);
        } else {
            showError(errorMsg1, true);
        }
    });

    // === Page 2 Logic ===
    // Simple case-insensitive check
    const checkAnswer = (input, qNum) => {
        return input.value.trim().toLowerCase() === ANSWERS[qNum].toLowerCase();
    };

    btnQ1.addEventListener('click', () => {
        if (checkAnswer(inputAns1, 1)) {
            showError(errorMsg2, false);
            q1Container.classList.add('hidden');
            q2Container.classList.remove('hidden');
            q2Container.classList.add('fade-in');
            progressBar.style.width = '66%';
        } else {
            showError(errorMsg2, true);
        }
    });

    btnQ2.addEventListener('click', () => {
        if (checkAnswer(inputAns2, 2)) {
            showError(errorMsg2, false);
            q2Container.classList.add('hidden');
            q3Container.classList.remove('hidden');
            q3Container.classList.add('fade-in');
            progressBar.style.width = '100%';
        } else {
            showError(errorMsg2, true);
        }
    });

    btnQ3.addEventListener('click', () => {
        if (checkAnswer(inputAns3, 3)) {
            showError(errorMsg2, false);
            showPage(3);
        } else {
            showError(errorMsg2, true);
        }
    });

    // === Page 3 Logic ===
    // Auto-reveal next field if "upload" or paste is simulated by typing > 5 chars
    // For simplicity, we trigger next field immediately when the current one has content

    function checkKeys() {
        const k1 = key1.value.trim();
        const k2 = key2.value.trim();
        const k3 = key3.value.trim();

        if (k1.length > 0) {
            key2Container.classList.remove('hidden');
        }
        if (k1.length > 0 && k2.length > 0) {
            key3Container.classList.remove('hidden');
        }
        if (k1.length > 0 && k2.length > 0 && k3.length > 0) {
            btnDecrypt.classList.remove('hidden');
            btnDecrypt.classList.add('fade-in');
        }
    }

    [key1, key2, key3].forEach(el => {
        el.addEventListener('input', checkKeys);
    });

    btnDecrypt.addEventListener('click', () => {
        // Assume valid if we got here
        showPage(4);
    });

    // === Page 4 Logic ===
    btnFinalUnlock.addEventListener('click', () => {
        confirmStep.classList.add('hidden');
        loaderStep.classList.remove('hidden');

        let i = 0;
        const interval = setInterval(() => {
            if (i < messages.length) {
                loadingText.innerText = messages[i];
                i++;
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    showPage(5);
                }, 1000);
            }
        }, 1500); // 1.5s per message
    });

    // === Page 5 Logic ===
    btnExit.addEventListener('click', () => {
        modalExit.classList.remove('hidden');
    });

    btnStay.addEventListener('click', () => {
        modalExit.classList.add('hidden');
    });

    btnConfirmExit.addEventListener('click', () => {
        modalExit.classList.add('hidden');
        // Reset everything
        inputId.value = '';
        inputAns1.value = '';
        inputAns2.value = '';
        inputAns3.value = '';
        key1.value = '';
        key2.value = '';
        key3.value = '';

        // Reset UI states
        q1Container.classList.remove('hidden');
        q2Container.classList.add('hidden');
        q3Container.classList.add('hidden');
        progressBar.style.width = '33%';
        key2Container.classList.add('hidden');
        key3Container.classList.add('hidden');
        btnDecrypt.classList.add('hidden');
        confirmStep.classList.remove('hidden');
        loaderStep.classList.add('hidden');
        loadingText.innerText = messages[0] || "Vault is being downloaded..."; // reset text

        showPage(1);
    });

});
