import { glob } from 'glob';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const GLOBAL_RESET_EPOCH_KEY = 'globalResetEpoch';
  const WORKSPACE_RESET_EPOCH_KEY = 'workspaceResetEpoch';
  const statusTextArray = [`$(bg-leftup)$(bg-rightup)`, `$(bg-leftdown)$(bg-rightup)`, `$(bg-leftup)$(bg-rightdown)`];
  let currentIndex = 0;
  let leftWasLastDown = false;
  let timeout: NodeJS.Timeout | undefined;
  let statusBarVisible = true;

  // Load counters from extension storage
  let workspaceCounter = context.workspaceState.get<number>('workspaceCounter', 0);
  let globalCounter = context.globalState.get<number>('globalCounter', 0);
  let globalResetEpoch = context.globalState.get<number>(GLOBAL_RESET_EPOCH_KEY, 0);
  let workspaceResetEpoch = context.workspaceState.get<number>(WORKSPACE_RESET_EPOCH_KEY, globalResetEpoch);

  // If global reset happened in another workspace, clear this workspace counter on open.
  if (workspaceResetEpoch !== globalResetEpoch) {
    workspaceCounter = 0;
    workspaceResetEpoch = globalResetEpoch;
    void context.workspaceState.update('workspaceCounter', workspaceCounter);
    void context.workspaceState.update(WORKSPACE_RESET_EPOCH_KEY, workspaceResetEpoch);
  }

  const persistCounters = async () => {
    await context.workspaceState.update('workspaceCounter', workspaceCounter);
    await context.workspaceState.update(WORKSPACE_RESET_EPOCH_KEY, workspaceResetEpoch);
    await context.globalState.update('globalCounter', globalCounter);
  };

  const persistGlobalResetEpoch = async () => {
    await context.globalState.update(GLOBAL_RESET_EPOCH_KEY, globalResetEpoch);
  };

  const bumpCounter = () => {
    currentIndex = leftWasLastDown ? 2 : 1;
    workspaceCounter++;
    globalCounter++;
    void persistCounters();
    leftWasLastDown = !leftWasLastDown;

    statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;

    if (timeout) clearTimeout(timeout);

    // Reset to default animation after 0.5s of no typing
    timeout = setTimeout(() => {
      currentIndex = 0;
      statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
    }, 500);
  };

  let showWorkspace = true; // toggle between workspace/global display
  const swapInterval = 3000; // 3 seconds

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
  statusBarItem.show();

  // Swap workspace/global display every 3 seconds
  const interval = setInterval(() => {
    showWorkspace = !showWorkspace;
    statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
  }, swapInterval);

  const onDelete = vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) {
      return;
    }

    const hasDeletion = event.contentChanges.some((change) => change.rangeLength > 0 && change.text.length === 0);
    if (hasDeletion) {
      bumpCounter();
    }
  });

  const onType = vscode.commands.registerCommand('type', async (args: { text: string }) => {
    const activeEditor = vscode.window.activeTextEditor;
    const versionBefore = activeEditor?.document.version;
    await vscode.commands.executeCommand('default:type', args);
    if (activeEditor && typeof versionBefore === 'number' && activeEditor.document.version !== versionBefore) {
      bumpCounter();
    }
  });

  // Toggle status bar visibility
  const toggleStatusBarCommand = vscode.commands.registerCommand('extension.toggleStatusBar', () => {
    statusBarVisible = !statusBarVisible;
    if (statusBarVisible) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });

  // Reset counters (workspace, global, or both)
  const resetCounterCommand = vscode.commands.registerCommand('extension.resetCounter', async () => {
    const choice = await vscode.window.showQuickPick(
      ['Reset Workspace Counter', 'Reset Global Counter'],
      { placeHolder: 'Which counter do you want to reset?' }
    );

    if (choice === 'Reset Workspace Counter') {
      globalCounter -= workspaceCounter;
      workspaceCounter = 0;
    }
    if (choice === 'Reset Global Counter') {
      globalCounter = 0;
      workspaceCounter = 0;
      globalResetEpoch += 1;
      workspaceResetEpoch = globalResetEpoch;
      void persistGlobalResetEpoch();
    }
    void persistCounters();

    statusBarItem.text = `${statusTextArray[currentIndex]} ${showWorkspace ? `W:${workspaceCounter}` : `G:${globalCounter}`}`;
  });

  context.subscriptions.push(onType, onDelete, toggleStatusBarCommand, resetCounterCommand);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}