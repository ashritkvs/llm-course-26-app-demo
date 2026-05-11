# set of classes to store data on C++ files that can then
# be used for the generation of a code visualization

DICT_VAR_LABEL = "vars"
DICT_METHOD_LABEL = "methods"
DICT_CLASS_LABEL = "classes"


# string, string, string
# TODO: scope?
class Variable:
    # init with all params
    # varSource refers to libs like std::, etc
    def __init__(self, varSource, varType, varName):
        self.varSource = varSource
        self.varType = varType
        self.varName = varName
    
    # override default print
    def __str__(self):
        if self.varSource == None:
            return "".join([self.varType,": ",self.varName])
        else:
            return "".join([self.varSource,"::",self.varType," ",self.varName])
    
    # summary string 
    def contentStr(self, indent=""): 
        if self.varSource != None:
            return "".join([indent,self.varSource,"::",self.varType," ",self.varName])
        else:
            return "".join([indent,self.varType," ",self.varName])
    
    # getters (return objects)
    def getName(self): return self.varName
    def getType(self): return self.varType
    def getSource(self): return self.varSource
    
    # comparison of variables
    def equals(self, otherVar): return self.varName == otherVar.getName();
    

# not sure if i want to use this
class Structure:
    def __init__(self, structType):
        self.structType = structType


# string, Variable[], string, Variable[], Variable
class Method:
    # init with all params
    def __init__(self, methodName, params, returnType, containedVars, returnVar):
        self.methodType = methodName
        self.params = params
        self.returnType = returnType
        # list of every appearance of every variable (yes this will be a lot)
        self.containedVars = containedVars
        self.returnVar = returnVar
        self.callsInOrder = []
    # init with empty arrays
    def __init__(self, returnType, methodName, params):
        self.methodName = methodName
        self.params = params
        self.returnType = returnType
        # list of every appearance of every variable (yes this will be a lot)
        self.containedVars = []
        self.returnVar = None
    # override to print something less opaque than object
    # <type> <methodname>()
    def __str__(self):
        return "".join([self.returnType," ",self.methodName,"()"])
    
    # <type> <name>(<# params>)
    # robust to degenerate overloads
    def methodID(self):
        if self.params == None or len(self.params) == 0:
            paramList = [""]
        else:
            types = [x.getType() for x in self.params]
            paramList = ["" if x == None else x for x in types]
        return "".join([self.returnType," ",self.methodName,"(",",".join(paramList),")"])

    # inserting data
    def addVariable(self, var): self.containedVars.append(var)
    def addParam(self, param): self.params.append(param)

    def getName(self): return self.methodName
    def getVariables(self): return self.containedVars

    # returns string for object summary
    def contentStr(self, indent=""):
        output = []
        output.append("".join([indent,self.returnType," ",self.methodName,"()"]))
        for var in self.containedVars:
            output.append("".join([indent,var.contentStr(indent)]))
        return "\n".join(output)
    
    # returns methodID (str), variable list
    def contentDict(self):
        var_list = []
        for var in self.containedVars:
            var_list.append(var)
        return self.methodID(), var_list


# contained methods and vars in order of declaration
# string, Method[], Variable[]
class ObjectClass:
    # init with all values known
    def __init__(self, classParent, className, containedMethods, containedVars):
        self.className = className
        self.containedMethods = containedMethods
        self.containedVars = containedVars  
        self.classParent = classParent
    # init with blank arrays
    def __init__(self, classParent, className):
        self.className = className
        self.classParent = classParent
        self.containedMethods = []
        self.containedVars = []
    # for printing something other than the opaque object
    def __str__(self):
        return self.className
    
    # inserting data
    def addVariable(self, var): self.containedVars.append(var)
    def addMethod(self, method): self.containedMethods.append(method)

    # class name should not be degenerate?
    def classID(self): return self.className

    def getName(self): return self.className
    def getMethods(self): return self.containedMethods
    def getVariables(self): return self.containedVars

    # returns string for object summary
    def contentStr(self, indent=""):
        output = []
        output.append("".join([indent, self.className]))
        for var in self.containedVars:
            output.append("".join([indent,var.contentStr(indent)]))
        for method in self.containedMethods:
            output.append("".join([indent,method.contentStr(indent)]))
        return "\n".join(output)
    
    # return class name (str), varList, {methodID: varList}
    def contentDict(self):
        method_dict = {}
        for method in self.containedMethods:
            ID, vars = method.contentDict()
            if ID in method_dict.keys(): print("COLLISION:"+ID)
            else: method_dict[ID] = vars
        var_list = []
        for var in self.containedVars:
            var_list.append(var.contentStr())
        return self.classID(), var_list, method_dict


# contained objs/methods/vars in order of declaration in head file
# string, ObjectClass[], Method[], Variable[]
class FileInventory:
    def __init__(self, fileName, containedClasses, containedMethods, containedVars, includes):
        self.fileName = fileName
        self.containedClasses = containedClasses
        self.containedMethods = containedMethods
        self.containedVars = containedVars
        self.includes = includes

    def __init__(self, fileName):
        self.fileName = fileName        # string
        self.containedClasses = []      # Class
        self.containedMethods = []      # Method
        self.containedVars = []         # Variable
        self.includes = []              # File
    
    def addVariable(self, var): self.containedVars.append(var)
    def addMethod(self, method): self.containedMethods.append(method)
    def addObjectClass(self, obj): self.containedClasses.append(obj)
    # include is reference to a library or another file
    def addInclude(self, file): self.includes.append(file)
    
    def getObjectClasses(self): return self.containedClasses
    def getMethods(self): return self.containedMethods
    def getVariables(self): return self.containedVars
    def getName(self): return self.fileName

    def contentStr(self, indent=""):
        output = []
        output.append("".join([indent, self.fileName]))
        output.append("".join([indent,"    ","//// Variables ////"]))
        for var in self.containedVars:
            output.append(var.contentStr(indent+"    "))
        output.append("".join([indent,"    ","//// Methods ////"]))
        for method in self.containedMethods:
            output.append(method.contentStr(indent+"    "))
        output.append("".join([indent,"    ","//// Classes ////"]))
        for cl in self.containedClasses:
            output.append(cl.contentStr(indent+"    "))
        return "\n".join(output)
    
    def contentDict(self):
        #{class_name: {"vars": var_list[], "methods": method_list[]}}
        class_dict = {}
        count = 0
        for cl in self.containedClasses:
            cl_name, cl_vars, cl_methods = cl.contentDict()
            # check if class with same name but different contents
            if cl_name in class_dict.keys() and \
                str(class_dict[cl_name]["vars"]) != str(cl.contentDict()[1]): 
                print("class COLLISION: "+cl_name)
            else:
                class_dict[cl_name] = {"index": count, \
                                       DICT_VAR_LABEL : cl_vars, \
                                       DICT_METHOD_LABEL: cl_methods}
            count += 1
        #{methodID: var_list[]}
        method_dict = {}                
        for method in self.containedMethods:
            method_name, method_vars = method.contentDict()
            if method_name in method_dict.keys():
                print("COLLISION"+cl_name)
            else:
                method_dict[method_name] = method_vars
        #var_list[]
        var_list = []
        for var in self.containedVars:
            var_list.append(var.contentStr())
        return self.fileName, class_dict, method_dict, var_list

class FileCollection:
    def __init__(self, collectionName):
        self.collectionName = collectionName
        self.containedInventories = {}
    
    def addFile(self, file):
        self.containedInventories[file.getName()] = file

    def getAllFiles(self):
        return self.containedInventories

    # accepts class name string
    # returns filename>classname and None if none found
    def findClass(self, className):
        for file in self.containedInventories.values():
            for cl in file.getObjectClasses():
                if cl.getName() == className:
                    return file.getName()+">"+className
        return None
    
    # accepts method name string
    # returns filename>classname>methodname and None if none found
    def findMethod(self, methodName):
        for file in self.containedInventories.values():
            for cl in file.getObjectClasses():
                for method in cl.getMethods():
                    if method.getName() == methodName:
                        return file.getName()+">"+cl.getName()+">"+methodName
            for method in file.getMethods():
                if method.getName() == methodName:
                    return file.getName()+">>"+methodName
        return None
    
    # accepts method name string and specific filename to search
    # returns filename>classname>methodname and None if none found
    def findMethodGivenFile(self, methodName, fileName):
        for file in self.containedInventories.values():
            if file.getName() == fileName:
                for cl in file.getObjectClasses():
                    for method in cl.getMethods():
                        if method.getName() == methodName:
                            return file.getName()+">"+cl.getName()+">"+methodName
                for method in file.getMethods():
                    if method.getName() == methodName:
                        return file.getName()+">>"+methodName
            else:
                continue
        return None
    
    # accepts variable name string
    # returns filename>classname>methodname>variable and None if none found
    def findVariable(self, varName):
        for file in self.containedInventories.values():
            for cl in file.getObjectClasses():
                for method in cl.getMethods():
                    for var in method.getVariables():
                        if var.getName() == varName:
                            return file.getName()+">"+cl.getName()+">"+method.getName()+">"+varName
                for var in cl.getVariables():
                    if var.getName() == varName:
                        return file.getName()+">"+cl.getName()+">>"+varName
            for var in cl.getVariables():
                if var.getName() == varName:
                    return file.getName()+">>>"+varName
        return None
    
    # accepts variable name string and specific filename to search 
    # returns filename>classname>methodname>variable and None if none found
    def findVariableGivenFile(self, varName, fileName):
        for file in self.containedInventories.values():
            if file.getName() == fileName:
                for cl in file.getObjectClasses():
                    for method in cl.getMethods():
                        for var in method.getVariables():
                            if var.getName() == varName:
                                return file.getName()+">"+cl.getName()+">"+method.getName()+">"+varName
                    for var in cl.getVariables():
                        if var.getName() == varName:
                            return file.getName()+">"+cl.getName()+">>"+varName
                for var in cl.getVariables():
                    if var.getName() == varName:
                        return file.getName()+">>>"+varName
            else:
                continue
        return None
                


    def contentDict(self):
        file_dict = {}
        count = 0
        for file_name in self.containedInventories.keys():
            _, class_dict, method_dict, var_list = self.containedInventories[file_name].contentDict()
            file_dict[file_name] = {"index": count,
                                    DICT_CLASS_LABEL: class_dict,
                                    DICT_METHOD_LABEL: method_dict,
                                    DICT_VAR_LABEL: var_list}
            count += 1
        return file_dict
