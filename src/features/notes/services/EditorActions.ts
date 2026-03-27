// //src/app/components/notes/EditorActions.ts
// export const setLink = (editor: any) => {
//   const previous = editor.getAttributes("link").href || "";
//   const url = window.prompt("Enter URL:", previous);

//   if (url === null) return;
//   if (url === "") {
//     editor.chain().focus().unsetLink().run();
//     return;
//   }

//   editor.chain().focus().setLink({ href: url }).run();
// };
