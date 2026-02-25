const fs = require('fs');
const WIZARD_PATH = 'frontend/components/assistant-ui/tools/vault-creation-wizard/wizard.tsx';
const HOOK_PATH = 'frontend/components/assistant-ui/tools/vault-creation-wizard/hooks/use-vault-creation.ts';

if (!fs.existsSync('frontend/components/assistant-ui/tools/vault-creation-wizard/hooks')) {
  fs.mkdirSync('frontend/components/assistant-ui/tools/vault-creation-wizard/hooks');
}

const lines = fs.readFileSync(WIZARD_PATH, 'utf-8').split('\n');

const startIdx = lines.findIndex(l => l.includes('export function VaultCreationWizard'));
const renderIdx = lines.findIndex(l => l.includes('const renderStepContent = () => {'));

// All imports and outside helpers up to startIdx
const importsLines = lines.slice(0, startIdx);

// Extract logic lines
let logicLines = lines.slice(startIdx + 1, renderIdx);
// Remove first line which is `}: VaultCreationWizardProps) {` 
logicLines.shift();

// We need to parse all the const/let declarations inside `logicLines` to return them.
// But it's easier to just match `const [var, setVar] = useState` or `const handleName =` manually or semi-automatically.
// Let's find all root-level `const ` / `let ` declarations inside logicLines

const returns = [];
for (const line of logicLines) {
  const matchState = line.match(/^  const \[(\w+), (set\w+)\] = /);
  if (matchState) {
    returns.push(matchState[1]);
    returns.push(matchState[2]);
    continue;
  }

  const matchRef = line.match(/^  const (\w+) = useRef/);
  if (matchRef) {
    returns.push(matchRef[1]);
    continue;
  }

  const matchConst = line.match(/^  const (\w+) = /);
  if (matchConst) {
    returns.push(matchConst[1]);
    continue;
  }
}

// remove duplicates
const uniqueReturns = [...new Set(returns)];

const hookContent = `${importsLines.join('\n')}

export function useVaultCreation({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
}: VaultCreationWizardProps) {
${logicLines.join('\n')}
  return {
    ${uniqueReturns.join(', ')}
  };
}
`;

fs.writeFileSync(HOOK_PATH, hookContent);

const newWizardContent = `${importsLines.slice(0, importsLines.findIndex(l => l.includes('import { initialFormState'))).join('\n')}
import { initialFormState, steps } from "./constants";
import { useVaultCreation } from "./hooks/use-vault-creation";
import type { SecurityQuestion } from "./types";

export function VaultCreationWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
}: VaultCreationWizardProps) {
  const isDialog = variant === "dialog";
  const {
    ${uniqueReturns.join(', ')}
  } = useVaultCreation({ variant, open, onOpenChange, onStepChange, onResult });

${lines.slice(renderIdx).join('\n')}
`;

fs.writeFileSync(WIZARD_PATH, newWizardContent);
console.log("Vault Creation Wizard refactored successfully.");
