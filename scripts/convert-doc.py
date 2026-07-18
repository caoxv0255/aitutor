import sys
import os

try:
    import textract
    has_textract = True
except ImportError:
    has_textract = False

try:
    from win32com import client
    has_win32com = True
except ImportError:
    has_win32com = False

def convert_doc_to_txt(doc_path, output_path):
    if has_win32com:
        try:
            word = client.Dispatch("Word.Application")
            word.Visible = False
            
            doc = word.Documents.Open(os.path.abspath(doc_path))
            doc.SaveAs(os.path.abspath(output_path), FileFormat=2)
            doc.Close()
            word.Quit()
            
            print(f"SUCCESS(win32com): {doc_path} -> {output_path}")
            return True
        except Exception as e:
            print(f"ERROR(win32com): {doc_path} - {str(e)}")
    
    if has_textract:
        try:
            text = textract.process(doc_path)
            with open(output_path, 'wb') as f:
                f.write(text)
            print(f"SUCCESS(textract): {doc_path} -> {output_path}")
            return True
        except Exception as e:
            print(f"ERROR(textract): {doc_path} - {str(e)}")
    
    print(f"ERROR: No suitable library found to convert DOC files")
    return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert-doc.py <input.doc> <output.txt>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print(f"ERROR: File not found: {input_path}")
        sys.exit(1)
    
    convert_doc_to_txt(input_path, output_path)