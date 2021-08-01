import * as vscode from "vscode";
import {
  getLanguageService,
  Node,
  TextDocument as HtmlTextDocument,
} from "vscode-html-languageservice";

const CONFIG_PREFIX_KEY = "html-biscuits.annotationPrefix";
const CONFIG_COLOR_KEY = "html-biscuits.annotationColor";
const CONFIG_DISTANCE_KEY = "html-biscuits.annotationMinDistance";
const CONFIG_TRIM_BY_WORDS_KEY = "html-biscuits.annotationTrimByWords";
const CONFIG_MAX_LENGTH_KEY = "html-biscuits.annotationMaxLength";
const CONFIG_CURSOR_LINE_ONLY_KEY = "html-biscuits.annotationCursorLineOnly";

const htmlService = getLanguageService();

const toggleCommand = "html-biscuits.toggleBiscuitsShowing";

let shouldHideBiscuits = false;
let cursorLines: number[] = [];

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(toggleCommand, () => {
      shouldHideBiscuits = !shouldHideBiscuits;
      updateDecorations();
    })
  );

  let decorations: vscode.DecorationOptions[] = [];
  let activeEditor = vscode.window.activeTextEditor;
  cursorLines = [activeEditor?.selection?.active?.line ?? -1];

  const decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color:
        vscode.workspace.getConfiguration().get(CONFIG_COLOR_KEY) ||
        new vscode.ThemeColor("editorLineNumber.foreground"),
      margin: "2px",
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
  });

  vscode.window.onDidChangeTextEditorSelection((cursorLocationEvent) => {
    cursorLines = cursorLocationEvent.selections.map(
      (cursorLocation) => cursorLocation.end?.line ?? 0
    );

    updateDecorations(true);
  });

  function updateDecorations(isSelectionChange = false) {
    decorations = [];

    activeEditor = vscode.window.activeTextEditor;
    const document = activeEditor?.document;
    const prefix: string =
      vscode.workspace.getConfiguration().get(CONFIG_PREFIX_KEY) || "// ";
    const minDistance: number =
      vscode.workspace.getConfiguration().get(CONFIG_DISTANCE_KEY) || 0;
    const trimByWords: boolean =
      vscode.workspace.getConfiguration().get(CONFIG_TRIM_BY_WORDS_KEY) ||
      false;
    const maxLength: number =
      vscode.workspace.getConfiguration().get(CONFIG_MAX_LENGTH_KEY) || 42;
    const cursorLineOnly: boolean =
      vscode.workspace.getConfiguration().get(CONFIG_CURSOR_LINE_ONLY_KEY) ||
      false;

    if (!cursorLineOnly && isSelectionChange) {
      // if in a selection change but we dont care about the current cursor, just bail and leave the decorations as is
      return;
    }

    if (document) {
      const baseHtmlDocument = {
        ...document,
        uri: document?.uri.toString(),
      } as HtmlTextDocument;
      const parsedDocument = htmlService.parseHTMLDocument(baseHtmlDocument);

      let nodes: Node[] = parsedDocument.roots;
      let children: Node[] = [];
      while (nodes.length !== 0) {
        nodes.forEach((node) => {
          if (node.children.length) {
            children = [...children, ...node.children];
          }

          if (node.attributes && node.tag) {
            if (node.endTagStart) {
              const startLine = document.lineAt(
                document.positionAt(node.startTagEnd || node.endTagStart)
              );
              const line = document.lineAt(
                document.positionAt(node.endTagStart)
              );
              // TODO: see if we can get index a better way
              const indexOf = line.text.indexOf(`</${node.tag}`);

              const position = new vscode.Position(line.lineNumber, indexOf);

              const range = document.getWordRangeAtPosition(
                position,
                new RegExp(`</${node.tag}`)
              );

              const nodeAttributes = parsedDocument?.findNodeAt(
                node.endTagStart
              )?.attributes;

              if (
                range &&
                nodeAttributes &&
                activeEditor &&
                line.lineNumber - startLine.lineNumber >= minDistance
              ) {
                const { line, character } = range.start;

                const endOfLine = activeEditor.document.lineAt(line).range.end;

                const stringifiedAttributes = stringifyAttributes(
                  nodeAttributes,
                  prefix,
                  maxLength,
                  trimByWords
                );

                if (
                  stringifiedAttributes &&
                  maxLength > 0 &&
                  !shouldHideBiscuits &&
                  (!cursorLineOnly ||
                    (cursorLineOnly &&
                      cursorLines.indexOf(endOfLine?.line) > -1))
                ) {
                  decorations.push({
                    range: new vscode.Range(
                      activeEditor.document.positionAt(indexOf),
                      endOfLine
                    ),
                    renderOptions: {
                      after: {
                        contentText: stringifiedAttributes,
                      },
                    },
                  });
                }
              }
            }
          }
        });

        nodes = children;
        children = [];
      }
    }

    if (activeEditor) {
      activeEditor?.setDecorations(decorationType, decorations);
    }
  }

  if (activeEditor) {
    updateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        updateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        updateDecorations();
      }
    },
    null,
    context.subscriptions
  );
}

function stringifyAttributes(
  attributes: any,
  prefix: string,
  maxLength: number,
  trimByWords = false
) {
  let stringifiedAttributes = "";
  if (attributes.id) {
    stringifiedAttributes += `#${attributes.id}`.replace('"', "");
  }
  if (attributes.class) {
    stringifiedAttributes = addDecoratedClassNamesWithDot(
      stringifiedAttributes,
      attributes.class
    );
  }
  if (attributes.className) {
    stringifiedAttributes = addDecoratedClassNamesWithDot(
      stringifiedAttributes,
      attributes.className
    );
  }
  stringifiedAttributes = stringifiedAttributes.replace('"', "");

  if (trimByWords) {
    const words = stringifiedAttributes.split(" ");
    if (words.length > maxLength) {
      const slicedWords = words
        .filter((word) => word !== "" && word !== " ")
        .slice(0, maxLength);
      stringifiedAttributes = slicedWords.join(" ") + "...";
    }
  } else if (!trimByWords && stringifiedAttributes.length > maxLength) {
    stringifiedAttributes = stringifiedAttributes.slice(0, maxLength) + "...";
  }

  stringifiedAttributes = prefix + stringifiedAttributes;
  if (stringifiedAttributes !== prefix) {
    return stringifiedAttributes;
  }
  return "";
}

function addDecoratedClassNamesWithDot(
  originalString: string,
  classNames: string
) {
  return (originalString +=
    " " +
    classNames
      .split(" ")
      .map((className: string) => {
        return `.${className}`.replace('"', "");
      })
      .join(" ")
      .replace('"', ""));
}
