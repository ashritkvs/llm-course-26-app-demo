import cpp_structs
from cpp_structs import FileCollection
from cpp_structs import FileInventory
from cpp_structs import ObjectClass
from cpp_structs import Method
from cpp_structs import Variable
from collections import defaultdict
from collections import defaultdict
from io import TextIOWrapper
import os, sys
import json

import re

# accepts a string of whatever is between the parentheses
# of a method and returns a list of Variable objs
# returns an empty list if no params
def getParams(raw_string):
    if raw_string == "": return []
    arg_list = []
    tmp_arg = ""
    in_brack = False
    # some arguments can contain commas so we need to do this explicitly
    for char in raw_string:
        if char == "<": in_brack = True; 
        if char == ">": in_brack = False; 
        if char == "," and not in_brack:
            arg_list.append(tmp_arg)
            tmp_arg = ""
        else:
            tmp_arg += char
    arg_list.append(tmp_arg)
    arg_tuples = []
    for a in arg_list:
        arg = a.split()
        if len(arg) > 1:
            argname = arg[-1]
            argsource, argtype = getVarSourceType("".join(arg[:-1]))
            arg_tuples.append(Variable(argsource, argtype, argname))
        else: 
            argsource, argtype = getVarSourceType(arg[0])
            arg_tuples.append(Variable(argsource, argtype, None)) 
    return arg_tuples

# accepts a string that precedes a variable name and
# returns the variable type and its source if applicable
# if no source, returns None
def getVarSourceType(raw_string):
    # ensure pointer definition is adjacent to variable type
    while " *" in raw_string:
        raw_string = raw_string.replace(" *", "*")
    while " &" in raw_string:
        raw_string = raw_string.replace(" &", "&")
    if "<" in raw_string and "::" in raw_string:
        type_substr, in_brack = raw_string.split("<", 1)
        if "::" in type_substr:
            source, type = type_substr.rsplit("::", 1)
        else:
            source = None
            type = type_substr
        type = "".join([type,"<",in_brack])
    elif "::" in raw_string:
        source, type = raw_string.rsplit("::", 1)
    else:
        source = None
        type = raw_string
    return source, type
    

# reads through .h file:
# - catalogues all variables and methods defined therein
#   and returns as File object
# assumes passed file is a zipfile object
def outline_h_file(file, filename):
    hname = filename.split("/")[-1][:-2]
    h_file_obj = FileInventory(hname)


    in_comment_block = False
    in_method = False
    in_multiline = False
    in_namespace = False
    current_class = "NONE"
    c = None
    prevlines = []

    for line in file.readlines():
        # handle various comment cases
        if "//" in line: line = line.split("//")[0]
        if "*/" in line: 
            in_comment_block = False
            continue
        elif "/*" in line:
            in_comment_block = True
        if in_comment_block: continue

        # process line
        line = line.strip()
        line = line.replace(">", "> ")
        linelist = line.split()

        if re.compile("^namespace.*{").match(line):
            in_namespace = True

        # skip empty lines
        if len(linelist) == 0: continue

        # code spanning multiple lines
        if ';' not in line and '#' not in line and '{' not in line and 'public:' not in line:
            in_multiline = True
            prevlines.append(line.strip())
            continue

        if in_multiline and ';' in line:
            line = " ".join([" ".join(prevlines), line.strip()])
            in_multiline = False
            prevlines = []
        elif in_multiline:
            prevlines.append(line.strip())
        
        # any method defined in header does not need to be evaluated
        if in_method:
            if '}' in line: in_method = False
            continue

        if in_namespace:
            if '}' in line: in_namespace = False
            continue

        # includes
        if "#include" in line:
            param = linelist[1]
            if "<" in param: 
                param = param.split("<")[1].split(">")[0]
                type = "std"
            if "\"" in param: 
                param = param.split("\"")[1]
                type = "custom"
            h_file_obj.addInclude(param)
        # handle macros and other # cases
        elif '#' in line:
            if '#define' in line:
                h_file_obj.addVariable(Variable(None, 'macro', linelist[1]))
            # otherwise probably an #ifdef or some such 
        # class-type definitions, create container
        elif re.compile("^class ").match(line) or \
                re.compile("^typedef.*{").match(line) or \
                re.compile("^extern.*{").match(line): #or \
                #re.compile("^namespace.*{").match(line):
            # remove space between class name and bracket
            while " {" in line:
                line = line.replace(" {", "{")
            # read inheritance definition if :public
            if ":public" in line: 
                cname = line.split(":public")[0].split()[-1]
                cparent = line.split(":public")[1].strip("{")
                current_class = cname
            else: # otherwise read standard
                linelist = line.split()
                current_class = linelist[-1].strip("{")
                cname = linelist[-1].strip("{")
                cparent = None
            c = ObjectClass(cparent, cname)
        # just defines that all vars after it are public
        elif "public:" in line:
            # all public vars
            pass
        # check for method declaration and store method + args
        elif re.compile(".*\\(.*\\);").match(line):
            # text before ()
            pre_paren = line.split("(")[0].strip().split(" ")
            # text in ()
            in_paren = line.split("(")[1].strip().split(")")[0].strip()
            if len(pre_paren) == 1: #constructor/destructor, just method name
                if "~" in line: returnType = "destructor"
                else: returnType = "constructor"
                params = getParams(in_paren)
                rawName = pre_paren[-1]
                if rawName == "clear" or rawName == "push_back" or rawName == "close": # special confusion cases
                    continue
                if current_class != "NONE":
                    c.addMethod(Method(returnType, rawName, params))
                else:
                    h_file_obj.addMethod(Method(returnType, rawName, params))
            else: # method with return type defined
                returnType = " ".join(pre_paren[:-1]).strip()
                rawName = pre_paren[-1].strip()
                if rawName == "clear" or rawName == "push_back" or rawName == "close": # special confusion cases
                    continue
                params = getParams(in_paren)
                if current_class != "NONE":
                    c.addMethod(Method(returnType, rawName, params))
                else:
                    h_file_obj.addMethod(Method(returnType, rawName, params))
        # method being defined in a class
        elif re.compile(".*\\(.*\\).*{").match(line) and current_class != "NONE":
            if "}" not in line:
                in_method = True                    
                returnType = linelist[0]
            else: # if some psycho defined a single line method
                returnType = "bool"
        # end of a class (end of method handled earlier)
        elif "}" in line:
            current_class = "NONE"
            c.contentStr("")
            h_file_obj.addObjectClass(c)
        else: # assumed to be variable definitions
            linelist = line.strip(";").strip().split()
            varName = linelist[-1].strip()
            varSource, varType = getVarSourceType(" ".join(linelist[:-1]))
            if current_class != "NONE":
                c.addVariable(Variable(varSource, varType, varName))
            else:
                h_file_obj.addVariable(Variable(varSource, varType, varName))                
    return h_file_obj


# reads through provided .cpp file and maps each method or
# variable call to occurrences in the header_collection
def map_cpp_file(cpp_file, fileName, header_collection, method_connectivity_data, class_connectivity_data):
    class_file_map = {}  # class: filename
    method_file_map = {} # method: filename>class
    var_file_map = {}    # var: filename>class>method
    all_files = header_collection.getAllFiles()

    # generate lookup dictionary for item file membership
    for key in all_files.keys():
        file = all_files[key]
        file_name = file.getName()
        for cl in file.getObjectClasses():
            cl_id = file_name+">"+cl.getName()
            class_file_map[cl_id] = file_name
            for method in cl.getMethods():
                m_id = cl_id + ">" + method.getName()
                method_file_map[m_id] = file_name
                for var in method.getVariables():
                    v_id = m_id+">"+var.getName()
                    var_file_map[v_id] = file_name
            for var in cl.getVariables():
                v_id = cl_id + ">>" + var.getName()
                var_file_map[v_id] = file_name
        for method in file.getMethods():
            m_id = file_name+">>"+method.getName()
            method_file_map[m_id] = file_name
        for var in file.getVariables():
            v_id = file_name+">>>"+var.getName()
            var_file_map[v_id] = file_name
    
    #print([method_file_map.keys()])

    
    # to populate: 
    #    appearance of each class in other classes
    #    class_connectivity_data
    #    {parentFile>className: [parentFile>className, ...], ...}
    #
    #    appearance of each method in other classes
    #    method_connectivity_data
    #    {parentFile>className>methodName: [parentFile>className, ...], ...}

    current_method = "NONE"
    current_class = "NONE"
    in_comment_block = False
    in_multiline = False
    struct_layer = 0 # handling for loops etc
    prevlines = []
    file = fileName.split("/")[-1].split(".")[0]
    line_num = 1
    
    for line in cpp_file:
        # handle various comment cases
        if "//" in line: line = line.split("//")[0]
        if "*/" in line: 
            in_comment_block = False
            continue
        elif "/*" in line:
            in_comment_block = True
        if in_comment_block: continue

        # process line
        line = line.strip()
        line = line.replace(">", "> ")
        linelist = line.split()

        # skip empty lines
        if len(linelist) == 0: continue

        # code spanning multiple lines
        if ';' not in line and '#' not in line and '{' not in line and 'public:' not in line and '}' not in line:
            in_multiline = True
            prevlines.append(line.strip())
            continue
        if in_multiline and ';' in line or '{' in line:
            line = " ".join([" ".join(prevlines), line.strip()])
            in_multiline = False
            prevlines = []

        #print(current_method, struct_layer, line)

        # sweep for additional variables
        if '#define' in line:
            #current_file.addVariable(None, 'macro', linelist[1])
            pass
        elif re.compile(".*\\(.*\\).*{").match(line):
            # note that if statements and for loops can match this without the current_method qualifier 
            # find the method in the file in preparation for appending vars

            # text before ()
            pre_paren = line.split("(")[0].strip()
            if "for" in pre_paren or "while" in pre_paren or "if" in pre_paren or "switch" in pre_paren:
                struct_layer += 1
                continue
            # text in ()
            in_paren = line.split("(")[1].strip().split(")")[0].strip()

            class_split = pre_paren.replace("}", "").strip().split("::")
            if len(class_split) > 1:
                method_name = pre_paren.split("::")[1]
                typeandname = pre_paren.split("::")[0].replace("}", "").strip()
                if len(typeandname.split()) == 1: # constructor/destructor
                    class_name = typeandname.strip()
                else:
                    class_name = typeandname.strip().split()[1]                    
            else: # this is a method defined in the .cpp file which we do not track in the current vis
                method_name = "NONE"
                class_name = "UNK"
                
            current_method = method_name
            current_class = class_name
        # end method definition
        elif '}' in line and current_method != "NONE":
            if struct_layer == 0:
                current_method = "NONE"
                current_class = "NONE"
            else: 
                struct_layer -= 1
        # method or method chain present in line
        elif re.compile(".*\\.\\w*\\(.*\\)").match(line) and current_method != "NONE":
            #print(current_method)
            # ignore control statements for the moment
            line = line.replace("(", " ( ")  \
                        .replace(")", " ) ")  \
                        .replace(",", " , ")
            #print(line)

            period_split = line.split(".")
            #print(period_split)


            if len(period_split) == 2 and "(" in period_split[1]:
                #print(line)
                #print(period_split)
                subj_var_name = period_split[0].rsplit(" ", 1)[-1].strip()
                subj_var_name = re.sub(r"[^0-9a-zA-Z _]", "", subj_var_name)
                subj_method_name = period_split[1].split("(", 1)[0].strip()
                
                parentMethod = header_collection.findMethodGivenFile(subj_method_name, file)
                if parentMethod == None: # method defined outside of this header
                    parentMethod = header_collection.findMethod(subj_method_name)

                # check if variable was declared in this file or elsewhere
                parentVar = header_collection.findVariableGivenFile(subj_var_name, file)
                if parentVar == None: # variable defined outside of this header
                    parentVar = header_collection.findVariable(subj_var_name)

                if parentMethod != None: # method is declared in another file outside this one
                    loc = file+">"+current_class
                    if loc not in method_connectivity_data[parentMethod]:
                        method_connectivity_data[parentMethod].append(loc)
                    parentClass = parentMethod.rsplit(">", 1)[0]
                    if loc not in class_connectivity_data[parentClass]:
                        class_connectivity_data[parentClass].append(loc)
            elif len(period_split) > 2:
                paren_split = line.split("(")
                for clause in paren_split:
                    if "." in clause:
                        period_split = clause.split(".")
                        # this ignores method/attribute chaining
                        subj_var_name = period_split[0].rsplit(" ", 1)[-1].strip()
                        subj_var_name = re.sub(r"[^0-9a-zA-Z ]", "", subj_var_name)
                        subj_method_name = period_split[-1].split("(", 1)[0].strip()
                        
                        parentMethod = header_collection.findMethodGivenFile(subj_method_name, file)
                        if parentMethod == None: # method defined outside of this header
                            parentMethod = header_collection.findMethod(subj_method_name)

                        # check if variable was declared in this file or elsewhere
                        parentVar = header_collection.findVariableGivenFile(subj_var_name, file)
                        if parentVar == None: # method defined outside of this header
                            parentVar = header_collection.findVariable(subj_var_name)

                        if parentMethod != None: # method is declared in another file outside this one
                            loc = file+">"+current_class
                            if loc not in method_connectivity_data[parentMethod]:
                                method_connectivity_data[parentMethod].append(loc)
                            # convert file>class>method to file>class
                            parentClass = parentMethod.rsplit(">", 1)[0]
                            if loc not in class_connectivity_data[parentClass]:
                                class_connectivity_data[parentClass].append(loc)
                    else:
                        pass
                    
        elif current_class != "NONE": # hey maybe there's a variable class defined in here that we can map
            for word in linelist:
                wordclass = header_collection.findClass(word)
                if wordclass != None:
                    class_connectivity_data[wordclass].append(file+">"+current_class)
        
        line_num += 1
    return method_connectivity_data, class_connectivity_data


def parse_codebase_zip(codebase_zip):
    codebase_obj = FileCollection("codebase")

    #codebase_zip = zipfile.ZipFile("/Users/albus/Downloads/dock_codebase.zip", 'r')

    # parse codebase headers and store in custom data structure
    for filename in codebase_zip.namelist():
        if filename[-2:] == '.h' and filename.count("/") == 1:
            with TextIOWrapper(codebase_zip.open(filename)) as header:                
                codebase_obj.addFile(outline_h_file(header, filename))

    file_classes = defaultdict(list)
    class_methods = defaultdict(list)

    # run through the header files and populate
    #  - classes contained in each file
    #  - methods contained in each class
    for file in codebase_obj.getAllFiles().values():
        fname = file.getName()
        for cl in file.getObjectClasses():
            cname = cl.getName()
            file_classes[fname].append(cname)
            for method in cl.getMethods():
                mname = method.getName()
                class_methods[cname].append(mname)

    method_connectivity_data = defaultdict(list)
    class_connectivity_data = defaultdict(list)

    # parse codebase .cpp files and store method usage
    for filename in codebase_zip.namelist():
        if filename[-4:] == '.cpp':
            with TextIOWrapper(codebase_zip.open(filename), 'utf-8') as codefile:   
                method_connectivity_data, class_connectivity_data = map_cpp_file(codefile, filename, codebase_obj, method_connectivity_data, class_connectivity_data)

    all_data = {"class_methods":        class_methods,
                "file_classes":         file_classes,
                "method_connectivity":  method_connectivity_data,
                "class_connectivity":   class_connectivity_data
    }
        
    return all_data